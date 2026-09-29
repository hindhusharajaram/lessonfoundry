import hashlib
import re
from typing import Any, Dict, List, Optional, Tuple
import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.deps import require_teacher
from db.database import get_db
from db.models import Source, SourceChunk, SourceVersion
from engine.injection import scan_for_prompt_injections

router = APIRouter(prefix="/sources", tags=["sources"])


def normalize_whitespace(text: str) -> str:
    """Normalize text line breaks and unusual whitespace while keeping clean formatting."""
    if not text:
        return ""
    # Standardize line breaks
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Replace non-breaking and unusual spaces with standard space
    text = re.sub(r"[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]", " ", text)
    # Replace tabs with spaces
    text = text.replace("\t", "    ")
    # Remove control characters except newline
    text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", text)
    # Collapse 3+ consecutive newlines into 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_text_by_sentences(
    text: str,
    page_ranges: Optional[List[Tuple[int, int, int]]] = None,
    min_chunk_len: int = 600,
    max_chunk_len: int = 900,
) -> List[Dict[str, Any]]:
    """
    Split text into chunks of ~600-900 chars on sentence/paragraph boundaries.
    Guarantees exact offsets: text[char_start:char_end] == chunk_text.
    """
    if not text:
        return []

    # Find sentence / paragraph boundary split points
    # Split on punctuation followed by whitespace or double newlines
    split_pattern = re.compile(r"(?<=[.!?])\s+|\n\n+")
    
    sentence_spans: List[Tuple[int, int]] = []
    last_idx = 0
    for match in split_pattern.finditer(text):
        end_idx = match.start()
        if end_idx > last_idx:
            sentence_spans.append((last_idx, end_idx))
        last_idx = match.end()
    if last_idx < len(text):
        sentence_spans.append((last_idx, len(text)))

    if not sentence_spans:
        sentence_spans = [(0, len(text))]

    chunks: List[Dict[str, Any]] = []
    current_start = sentence_spans[0][0]
    current_end = sentence_spans[0][1]

    for start, end in sentence_spans[1:]:
        potential_len = end - current_start
        if potential_len <= max_chunk_len or (current_end - current_start) < min_chunk_len:
            current_end = end
        else:
            # Finalize current chunk
            chunk_str = text[current_start:current_end]
            page_num = _get_page_for_offset(current_start, page_ranges)
            chunks.append({
                "idx": len(chunks),
                "char_start": current_start,
                "char_end": current_end,
                "page": page_num,
                "text": chunk_str,
            })
            current_start = start
            current_end = end

    # Add remaining text chunk
    if current_end > current_start:
        chunk_str = text[current_start:current_end]
        page_num = _get_page_for_offset(current_start, page_ranges)
        chunks.append({
            "idx": len(chunks),
            "char_start": current_start,
            "char_end": current_end,
            "page": page_num,
            "text": chunk_str,
        })

    return chunks


def _get_page_for_offset(char_offset: int, page_ranges: Optional[List[Tuple[int, int, int]]]) -> int:
    if not page_ranges:
        return 1
    for page_num, start, end in page_ranges:
        if start <= char_offset <= end:
            return page_num
    return page_ranges[-1][0] if page_ranges else 1


def extract_pdf_content(file_bytes: bytes) -> Tuple[str, List[Tuple[int, int, int]]]:
    """Extract text from PDF using PyMuPDF and record page character spans."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    full_text_parts = []
    page_ranges = []
    current_offset = 0

    for i, page in enumerate(doc):
        page_text = normalize_whitespace(page.get_text("text"))
        if page_text:
            if full_text_parts:
                full_text_parts.append("\n\n")
                current_offset += 2
            start = current_offset
            full_text_parts.append(page_text)
            current_offset += len(page_text)
            page_ranges.append((i + 1, start, current_offset))

    doc.close()
    full_text = "".join(full_text_parts)
    return full_text, page_ranges


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_source(
    title: Optional[str] = Form(None),
    source_id: Optional[int] = Form(None),
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """
    Ingest a source document from PDF, TXT or pasted text.
    - Extracts & normalizes text.
    - Computes SHA256.
    - If same source_id has different hash => creates new SourceVersion (version_no + 1).
    - If identical hash => returns existing version.
    - Chunks text into ~600-900 chars on sentence boundaries with exact char_start/char_end offsets.
    - Scans for prompt injections and records flags without altering source text.
    """
    raw_text = ""
    filename = "pasted_text.txt"
    page_ranges: List[Tuple[int, int, int]] = []

    if file is not None:
        filename = file.filename or "uploaded_file"
        content_bytes = await file.read()
        lower_name = filename.lower()
        if lower_name.endswith(".pdf"):
            try:
                raw_text, page_ranges = extract_pdf_content(content_bytes)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Could not parse PDF file: {str(e)}",
                )
        elif lower_name.endswith(".txt") or lower_name.endswith(".md"):
            raw_text = normalize_whitespace(content_bytes.decode("utf-8", errors="replace"))
        else:
            # Spec: PDF, TXT, DOCX-less (PDF/TXT only)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Please upload a PDF or TXT file, or paste text.",
            )
    elif text:
        raw_text = normalize_whitespace(text)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either a file upload or text content must be provided.",
        )

    if not raw_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source document contains no extractable text.",
        )

    # Compute SHA-256
    text_sha256 = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()

    # Find or create source
    source: Optional[Source] = None
    if source_id:
        source = db.query(Source).filter(Source.id == source_id).first()
        if not source:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source with id {source_id} not found.",
            )
        if title:
            source.title = title
    else:
        source_title = title or (filename.rsplit(".", 1)[0].replace("_", " ").title() if filename else "Untitled Source")
        source = Source(title=source_title, filename=filename)
        db.add(source)
        db.flush()

    # Check existing versions for this source
    latest_version = (
        db.query(SourceVersion)
        .filter(SourceVersion.source_id == source.id)
        .order_by(SourceVersion.version_no.desc())
        .first()
    )

    if latest_version and latest_version.sha256 == text_sha256:
        # Identical hash returns existing version
        flags = latest_version.injection_flags or {}
        return {
            "source_id": source.id,
            "source_title": source.title,
            "version_no": latest_version.version_no,
            "source_version_id": latest_version.id,
            "sha256": latest_version.sha256,
            "is_new_version": False,
            "chunks_count": len(latest_version.chunks),
            "injection_flags": flags,
            "message": "Source content identical to existing version; returned existing version.",
        }

    # Determine new version_no
    new_version_no = (latest_version.version_no + 1) if latest_version else 1

    # Scan for injections
    injection_report = scan_for_prompt_injections(raw_text)

    # Create new SourceVersion
    new_version = SourceVersion(
        source_id=source.id,
        version_no=new_version_no,
        text=raw_text,
        sha256=text_sha256,
        injection_flags=injection_report,
    )
    db.add(new_version)
    db.flush()

    # Create chunks
    chunk_dicts = chunk_text_by_sentences(raw_text, page_ranges=page_ranges)
    for c_data in chunk_dicts:
        chunk = SourceChunk(
            source_version_id=new_version.id,
            idx=c_data["idx"],
            char_start=c_data["char_start"],
            char_end=c_data["char_end"],
            page=c_data["page"],
            text=c_data["text"],
        )
        db.add(chunk)

    db.commit()
    db.refresh(new_version)

    return {
        "source_id": source.id,
        "source_title": source.title,
        "version_no": new_version.version_no,
        "source_version_id": new_version.id,
        "sha256": new_version.sha256,
        "is_new_version": True,
        "chunks_count": len(chunk_dicts),
        "injection_flags": injection_report,
        "message": f"Successfully ingested source version {new_version.version_no}",
    }


@router.get("/{source_id}/versions")
def get_source_versions(
    source_id: int,
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """List all versions of a source with hash and injection flag counts."""
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source with id {source_id} not found.",
        )

    versions = (
        db.query(SourceVersion)
        .filter(SourceVersion.source_id == source_id)
        .order_by(SourceVersion.version_no.asc())
        .all()
    )

    version_list = []
    for v in versions:
        flags = v.injection_flags or {}
        flag_count = flags.get("count", 0) if isinstance(flags, dict) else 0
        version_list.append({
            "version_id": v.id,
            "version_no": v.version_no,
            "sha256": v.sha256,
            "char_count": len(v.text),
            "chunk_count": len(v.chunks),
            "uploaded_at": v.uploaded_at.isoformat() if v.uploaded_at else None,
            "injection_flagged": flags.get("flagged", False) if isinstance(flags, dict) else False,
            "injection_flag_count": flag_count,
            "injection_flags": flags,
        })

    return {
        "source_id": source.id,
        "source_title": source.title,
        "filename": source.filename,
        "versions": version_list,
    }
