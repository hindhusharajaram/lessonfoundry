import re
from dataclasses import dataclass
from typing import Any, List, Optional, Sequence, Tuple
from rapidfuzz import fuzz


@dataclass
class VerificationResult:
    verified: bool
    match_score: float
    chunk_id: Optional[int] = None
    char_start: Optional[int] = None
    char_end: Optional[int] = None
    matched_text: Optional[str] = None
    note: Optional[str] = None


def normalize_for_matching(text: str) -> str:
    """Normalize text for quote matching: unify whitespace and remove straight/curly quote differences."""
    if not text:
        return ""
    # Standardize quotes and apostrophes
    text = text.replace("“", '"').replace("”", '"').replace("’", "'").replace("‘", "'")
    # Replace all whitespace sequences with single space
    text = re.sub(r"\s+", " ", text).strip()
    return text


def verify_quote(
    quote: str,
    chunks: Sequence[Any],
    fuzzy_threshold: float = 0.90,
) -> VerificationResult:
    """
    Non-LLM verifier:
    1. Normalized exact substring match in source chunks.
    2. High-confidence fuzzy substring match (score >= fuzzy_threshold, default 0.90).
    
    Returns VerificationResult with chunk_id, char_start/end offsets, and match_score.
    """
    clean_quote = normalize_for_matching(quote)
    if not clean_quote or len(clean_quote) < 3:
        return VerificationResult(
            verified=False,
            match_score=0.0,
            note="Empty or trivial quote",
        )

    clean_quote_lower = clean_quote.lower()
    best_score = 0.0
    best_chunk_id: Optional[int] = None
    best_start: Optional[int] = None
    best_end: Optional[int] = None
    best_matched_slice: Optional[str] = None

    # Step 1: Check Exact Substring Match across chunks
    for chunk in chunks:
        chunk_id = getattr(chunk, "id", chunk.get("id") if isinstance(chunk, dict) else None)
        chunk_text = getattr(chunk, "text", chunk.get("text", "") if isinstance(chunk, dict) else str(chunk))
        chunk_char_start = getattr(chunk, "char_start", chunk.get("char_start", 0) if isinstance(chunk, dict) else 0)

        # 1a. Raw exact match
        idx = chunk_text.find(quote.strip())
        if idx != -1:
            raw_len = len(quote.strip())
            return VerificationResult(
                verified=True,
                match_score=1.0,
                chunk_id=chunk_id,
                char_start=chunk_char_start + idx,
                char_end=chunk_char_start + idx + raw_len,
                matched_text=chunk_text[idx : idx + raw_len],
                note="Exact verbatim match",
            )

        # 1b. Normalized case-insensitive match
        norm_chunk = normalize_for_matching(chunk_text)
        norm_chunk_lower = norm_chunk.lower()
        idx_norm = norm_chunk_lower.find(clean_quote_lower)
        if idx_norm != -1:
            matched_slice = norm_chunk[idx_norm : idx_norm + len(clean_quote)]
            return VerificationResult(
                verified=True,
                match_score=1.0,
                chunk_id=chunk_id,
                char_start=chunk_char_start + idx_norm,
                char_end=chunk_char_start + idx_norm + len(matched_slice),
                matched_text=matched_slice,
                note="Normalized exact match",
            )

    # Step 2: Fuzzy Substring Matching
    quote_len = len(clean_quote)
    for chunk in chunks:
        chunk_id = getattr(chunk, "id", chunk.get("id") if isinstance(chunk, dict) else None)
        chunk_text = getattr(chunk, "text", chunk.get("text", "") if isinstance(chunk, dict) else str(chunk))
        chunk_char_start = getattr(chunk, "char_start", chunk.get("char_start", 0) if isinstance(chunk, dict) else 0)
        norm_chunk = normalize_for_matching(chunk_text)

        if not norm_chunk:
            continue

        # Fast partial ratio check
        p_ratio = fuzz.partial_ratio(clean_quote_lower, norm_chunk.lower()) / 100.0
        if p_ratio < (fuzzy_threshold - 0.05):
            if p_ratio > best_score:
                best_score = p_ratio
            continue

        # Sliding window alignment to find precise boundary offsets within the chunk
        win_size = quote_len
        step = max(1, win_size // 15)
        for w_start in range(0, max(1, len(norm_chunk) - win_size + 1), step):
            for delta in (-win_size // 5, 0, win_size // 5):
                cur_len = max(5, win_size + delta)
                w_end = min(len(norm_chunk), w_start + cur_len)
                candidate = norm_chunk[w_start:w_end]
                score = fuzz.ratio(clean_quote_lower, candidate.lower()) / 100.0
                if score > best_score:
                    best_score = score
                    best_chunk_id = chunk_id
                    best_start = chunk_char_start + w_start
                    best_end = chunk_char_start + w_end
                    best_matched_slice = candidate

    if best_score >= fuzzy_threshold:
        return VerificationResult(
            verified=True,
            match_score=round(best_score, 3),
            chunk_id=best_chunk_id,
            char_start=best_start,
            char_end=best_end,
            matched_text=best_matched_slice,
            note=f"Fuzzy match (score: {best_score:.2f})",
        )

    return VerificationResult(
        verified=False,
        match_score=round(best_score, 3),
        chunk_id=best_chunk_id,
        char_start=best_start,
        char_end=best_end,
        matched_text=best_matched_slice,
        note=f"Unverified quote (best match score {best_score:.2f} < threshold {fuzzy_threshold:.2f})",
    )
