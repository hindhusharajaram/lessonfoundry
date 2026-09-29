"""
Independent Solver Engine (engine/solver.py)

Rule 3: Independent solver: a separate model call answers each quiz/practice question
using ONLY the source, WITHOUT seeing the answer key or rationale.
Mismatch or unverified supporting quote => flag "answer_key_mismatch" (severity=error).

Limitation Documentation:
NOTE: The independent solver uses the primary/fallback model family (Gemini).
While isolating the solver from the generator's answer key and rationale prevents answer-key confirmation bias,
it reduces but does NOT completely eliminate correlated systemic model reasoning blind spots.
"""

from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.models import AssetVersion, QualityFlag, Slot, SourceChunk
from engine.model import build_source_block, generate_json
from engine.planner import score_chunks_for_query
from engine.verifier import verify_quote


class SolverAnswer(BaseModel):
    chosen_index: int = Field(
        ge=0, le=3, description="0-indexed integer (0, 1, 2, or 3) indicating the single correct option."
    )
    supporting_quote: str = Field(
        description="A verbatim quote from the source text that directly proves why this option is correct."
    )
    rationale: str = Field(
        description="Concise step-by-step reasoning based strictly and exclusively on the source."
    )


def solve_question_independently(
    question: str,
    options: List[str],
    source_chunks: List[SourceChunk],
    mock_answer: Optional[SolverAnswer] = None,
) -> Tuple[SolverAnswer, Dict[str, Any]]:
    """
    Solves a multiple-choice question using ONLY the question stem, 4 options, and source text.
    The solver is completely blinded to the generator's answer key, rationale, or original quotes.
    """
    if len(options) != 4:
        raise ValueError("Independent solver requires exactly 4 options.")

    relevant_chunks = score_chunks_for_query(f"{question} {' '.join(options)}", source_chunks, top_k=4)
    source_block = build_source_block(relevant_chunks)

    formatted_options = "\n".join([f"Option {i}: {opt}" for i, opt in enumerate(options)])

    prompt = (
        f"{source_block}\n\n"
        f"Solve the following multiple-choice question using ONLY facts found in the SOURCE above.\n"
        f"Do NOT make assumptions beyond the text.\n\n"
        f"Question:\n{question}\n\n"
        f"Options:\n{formatted_options}\n\n"
        f"Identify the single correct option index (0, 1, 2, or 3) and provide a verbatim supporting quote from the source."
    )

    if mock_answer is not None:
        return mock_answer, {"model": "mock-solver", "latency_ms": 10}

    ans_obj, meta = generate_json(
        prompt=prompt,
        schema=SolverAnswer,
        temperature=0.1,
        prompt_version="solver-1.0",
    )
    return ans_obj, meta


def verify_asset_with_solver(
    slot: Slot,
    asset_version: AssetVersion,
    db: Session,
    mock_answer: Optional[SolverAnswer] = None,
) -> Dict[str, Any]:
    """
    Runs the independent solver on a quiz or practice asset version.
    Updates asset_version.verification and creates QualityFlag if mismatch occurs.
    """
    if slot.type not in ["quiz_item", "practice_foundation", "practice_advanced"]:
        return {"applicable": False}

    content = asset_version.content or {}
    question = content.get("question", "")
    options = content.get("options", [])
    key_index = content.get("correct_index")

    if not question or len(options) != 4 or key_index is None:
        return {"applicable": False, "error": "Malformed question structure"}

    source_chunks = slot.unit.pinned_source_version.chunks if slot.unit.pinned_source_version else []
    if not source_chunks:
        return {"applicable": False, "error": "No source chunks available"}

    # Remove any existing solver flags for this asset version
    existing_flags = (
        db.query(QualityFlag)
        .filter(
            QualityFlag.asset_version_id == asset_version.id,
            QualityFlag.code == "answer_key_mismatch",
        )
        .all()
    )
    for f in existing_flags:
        db.delete(f)
    db.flush()

    try:
        solver_ans, meta = solve_question_independently(
            question=question,
            options=options,
            source_chunks=source_chunks,
            mock_answer=mock_answer,
        )

        # Verify solver's supporting quote against source chunks
        ver_quote_res = verify_quote(solver_ans.supporting_quote, source_chunks)
        matches_key = (solver_ans.chosen_index == key_index)

        solver_verification = {
            "solved_index": solver_ans.chosen_index,
            "key_index": key_index,
            "matches_key": matches_key,
            "solver_rationale": solver_ans.rationale,
            "supporting_quote": solver_ans.supporting_quote,
            "quote_verified": ver_quote_res.verified,
            "quote_match_score": ver_quote_res.match_score,
            "model": meta.get("model"),
        }

        # Update AssetVersion verification JSON
        current_ver = dict(asset_version.verification or {})
        current_ver["solver"] = solver_verification
        asset_version.verification = current_ver

        if not matches_key:
            flag = QualityFlag(
                unit_id=slot.unit_id,
                asset_version_id=asset_version.id,
                code="answer_key_mismatch",
                severity="error",
                message=(
                    f"Independent solver selected Option {solver_ans.chosen_index} ('{options[solver_ans.chosen_index]}') "
                    f"instead of Answer Key Option {key_index} ('{options[key_index]}'). "
                    f"Solver rationale: {solver_ans.rationale}"
                ),
            )
            db.add(flag)
            if asset_version.asset:
                asset_version.asset.status = "needs_revision"

        elif not ver_quote_res.verified:
            flag = QualityFlag(
                unit_id=slot.unit_id,
                asset_version_id=asset_version.id,
                code="answer_key_mismatch",
                severity="warning",
                message=(
                    f"Solver matched Answer Key Option {key_index}, but its supporting quote was unverified "
                    f"(score: {ver_quote_res.match_score:.2f})."
                ),
            )
            db.add(flag)

        db.commit()
        return solver_verification

    except Exception as e:
        flag = QualityFlag(
            unit_id=slot.unit_id,
            asset_version_id=asset_version.id,
            code="answer_key_mismatch",
            severity="warning",
            message=f"Independent solver execution error: {str(e)}",
        )
        db.add(flag)
        db.commit()
        return {"error": str(e), "matches_key": False}
