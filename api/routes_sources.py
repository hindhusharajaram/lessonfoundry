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


import logging

logger = logging.getLogger(__name__)

_ocr_engine = None


def get_ocr_engine():
    """Lazily load the RapidOCR engine to minimize startup overhead."""
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _ocr_engine = RapidOCR()
        except Exception as e:
            logger.warning(f"Could not initialize RapidOCR: {e}")
            _ocr_engine = None
    return _ocr_engine


def ocr_page_image(page) -> str:
    """Render PDF page as high-resolution pixmap and perform OCR extraction."""
    ocr = get_ocr_engine()
    if ocr is None:
        return ""
    try:
        # Render at 150 DPI for fast, crisp text recognition
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        result, _ = ocr(img_bytes)
        if not result:
            return ""
        # Sort text boxes top-to-bottom, left-to-right
        sorted_boxes = sorted(result, key=lambda r: (r[0][0][1], r[0][0][0]))
        lines = [item[1].strip() for item in sorted_boxes if item and len(item) > 1 and item[1].strip()]
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"OCR page extraction failed on page: {e}")
        return ""


def extract_pdf_content(file_bytes: bytes) -> Tuple[str, List[Tuple[int, int, int]]]:
    """
    Extract text from PDF using PyMuPDF and OCR fallback for scanned/image pages.
    Records precise page character spans (page_num, start_offset, end_offset).
    """
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        logger.error(f"Failed to open PDF stream: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not parse PDF file. The document may be corrupted or not a valid PDF format.",
        )

    if doc.is_encrypted or doc.needs_pass:
        doc.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF is password-protected or encrypted. Please remove password protection and try again.",
        )

    if len(doc) == 0:
        doc.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF contains no pages.",
        )

    full_text_parts = []
    page_ranges = []
    current_offset = 0

    for i, page in enumerate(doc):
        # 1. First attempt native digital text extraction
        raw_page_text = page.get_text("text")
        page_text = normalize_whitespace(raw_page_text)

        # 2. If native text is absent or extremely sparse, attempt OCR on page image
        if len(page_text) < 20:
            ocr_text = ocr_page_image(page)
            ocr_text_norm = normalize_whitespace(ocr_text)
            if len(ocr_text_norm) > len(page_text):
                page_text = ocr_text_norm

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

    if not full_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source document contains no extractable text or readable images. Please provide a document with legible curriculum content.",
        )

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

    has_file = file is not None and bool(file.filename)
    has_text = bool(text and text.strip())

    if has_file and has_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot provide both a file upload and pasted text. Please choose exactly one input method.",
        )
    if not has_file and not has_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either a file upload or text content must be provided.",
        )

    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_TEXT_LEN = 150000  # 150,000 characters

    if has_file and file is not None:
        filename = file.filename or "uploaded_file"
        content_bytes = await file.read()
        if len(content_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file is empty (0 bytes).",
            )
        if len(content_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds the maximum allowed limit of {MAX_FILE_SIZE // (1024 * 1024)}MB.",
            )
        lower_name = filename.lower()
        if lower_name.endswith(".pdf"):
            try:
                raw_text, page_ranges = extract_pdf_content(content_bytes)
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Unexpected error during PDF extraction: {e}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Could not parse PDF file: {str(e)}",
                )
        elif lower_name.endswith(".txt") or lower_name.endswith(".md"):
            raw_text = normalize_whitespace(content_bytes.decode("utf-8", errors="replace"))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Please upload a PDF (.pdf) or Text (.txt, .md) file.",
            )
    elif has_text and text:
        if len(text) > MAX_TEXT_LEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Text content exceeds the maximum allowed limit of {MAX_TEXT_LEN} characters.",
            )
        raw_text = normalize_whitespace(text)

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
