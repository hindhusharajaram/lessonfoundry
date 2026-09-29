import math
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.models import Asset, Objective, QualityFlag, Slot, SourceChunk, Unit
from engine.bloom import get_bloom_target_for_difficulty
from engine.model import build_source_block, generate_json
from engine.verifier import verify_quote


class ObjectiveSupportEvaluation(BaseModel):
    supported: bool = Field(
        description="True if the source text contains sufficient factual material to teach and assess this objective, False otherwise."
    )
    reason: str = Field(
        description="Clear explanation of why the source is sufficient or what specific required knowledge is missing."
    )
    evidence_quote: str = Field(
        description="A verbatim quote from the source text that directly supports this objective. If unsupported, provide empty string."
    )


def score_chunks_for_query(query: str, chunks: Sequence[SourceChunk], top_k: int = 4) -> List[SourceChunk]:
    """Score chunks based on keyword term frequency overlap (embedding-free)."""
    if not chunks:
        return []
    
    # Extract query tokens (ignoring short stop words)
    stop_words = {
        "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "with", "by", "from",
        "of", "is", "are", "was", "were", "be", "been", "that", "this", "these", "those",
        "it", "its", "as", "can", "will", "how", "what", "why", "which", "explain", "describe",
    }
    tokens = [w.lower() for w in re.findall(r"\b\w{3,}\b", query) if w.lower() not in stop_words]
    if not tokens:
        tokens = [w.lower() for w in re.findall(r"\b\w+\b", query)]

    scored = []
    for chunk in chunks:
        text_lower = chunk.text.lower()
        score = 0.0
        for t in tokens:
            count = text_lower.count(t)
            if count > 0:
                # Term frequency with diminishing returns
                score += 1.0 + math.log(count)
        scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    selected = [c for score, c in scored[:top_k]]
    # Fall back to first chunks if no keyword overlap
    if not selected:
        selected = list(chunks[:top_k])
    return selected


def evaluate_objective_gap(
    objective: Objective,
    chunks: Sequence[SourceChunk],
    db_session: Session,
    mock_decision: Optional[ObjectiveSupportEvaluation] = None,
) -> bool:
    """
    Check whether source chunks support the objective.
    Uses model evaluation + verifier to confirm quote validity.
    If unsupported, updates objective and adds a QualityFlag.
    """
    relevant_chunks = score_chunks_for_query(objective.text, chunks, top_k=4)
    source_block = build_source_block(relevant_chunks)

    if mock_decision is not None:
        eval_result = mock_decision
    else:
        prompt = (
            f"{source_block}\n\n"
            f"Target Objective: \"{objective.text}\"\n"
            f"Bloom Target: {objective.bloom_target}\n\n"
            f"Determine if the source text contains sufficient facts and explanations to teach and test this objective.\n"
            f"If YES, you MUST provide a verbatim quote from the source text as evidence.\n"
            f"If NO (or if the source only mentions the topic tangentially without necessary details), set supported=False with a clear reason."
        )
        try:
            eval_result, _ = generate_json(
                prompt=prompt,
                schema=ObjectiveSupportEvaluation,
                temperature=0.1,
                prompt_version="1.0",
            )
        except Exception as e:
            # On model error, default to unsupported with recorded error
            objective.supported = False
            objective.support_note = f"Gap evaluation model error: {str(e)}"
            flag = QualityFlag(
                unit_id=objective.unit_id,
                code="objective_unsupported",
                severity="error",
                message=f"Evaluation failed for objective '{objective.text}': {str(e)}",
            )
            db_session.add(flag)
            return False

    if not eval_result.supported:
        objective.supported = False
        objective.support_note = eval_result.reason
        flag = QualityFlag(
            unit_id=objective.unit_id,
            code="objective_unsupported",
            severity="error",
            message=f"Source lacks support for objective '{objective.text}': {eval_result.reason}",
        )
        db_session.add(flag)
        return False

    # Verify the provided evidence quote
    ver_res = verify_quote(eval_result.evidence_quote, chunks)
    if not ver_res.verified:
        objective.supported = False
        objective.support_note = (
            f"Model claimed support but evidence quote failed verification (score {ver_res.match_score:.2f}). "
            f"Reason: {eval_result.reason}"
        )
        flag = QualityFlag(
            unit_id=objective.unit_id,
            code="objective_unsupported",
            severity="error",
            message=f"Objective '{objective.text}' unverified: Quote '{eval_result.evidence_quote}' not found in source.",
        )
        db_session.add(flag)
        return False

    # Supported and verified
    objective.supported = True
    objective.support_note = f"Supported. Evidence verified in chunk {ver_res.chunk_id} (score {ver_res.match_score:.2f})."
    return True


def plan_unit(unit: Unit, db: Session) -> Dict[str, Any]:
    """
    1. Gap detection on all unit objectives.
    2. Blueprint generation for supported objectives:
       - 1 explanation, 1 example, 1 revision per supported objective.
       - quiz_count quiz items distributed across objectives (at least 1 per objective).
       - 5 practice_foundation + 5 practice_advanced items distributed across objectives.
       - Slots and empty Assets created.
    """
    if not unit.pinned_source_version or not unit.pinned_source_version.chunks:
        raise ValueError("Unit has no pinned source version or source chunks.")

    chunks = unit.pinned_source_version.chunks
    objectives = unit.objectives

    if len(objectives) < 2:
        raise ValueError("Unit requires at least 2 objectives.")

    # 1. Evaluate gap detection for each objective
    supported_objectives = []
    unsupported_objectives = []

    for obj in objectives:
        is_supported = evaluate_objective_gap(obj, chunks, db)
        if is_supported:
            supported_objectives.append(obj)
        else:
            unsupported_objectives.append(obj)

    db.flush()

    if not supported_objectives:
        unit.status = "draft"
        return {
            "unit_id": unit.id,
            "status": "no_supported_objectives",
            "total_objectives": len(objectives),
            "supported_objectives_count": 0,
            "unsupported_objectives_count": len(unsupported_objectives),
            "unsupported_details": [
                {"id": o.id, "text": o.text, "reason": o.support_note} for o in unsupported_objectives
            ],
            "slots_count": 0,
            "blueprint": [],
            "message": "All objectives were unsupported by the source text. No slots created.",
        }

    # Clear any previous slots and assets for this unit
    existing_slots = db.query(Slot).filter(Slot.unit_id == unit.id).all()
    for s in existing_slots:
        db.delete(s)
    db.flush()

    # 2. Build Blueprint
    # Spec Blueprint rule:
    # per objective: 1 explanation, 1 example, 1 revision
    # quiz_count quiz items and 5+5 foundation/advanced practice items distributed with at least 1 per objective per type.
    # Every Slot has an objective (no orphans).
    slots_to_create: List[Slot] = []
    pos = 0

    # 2a. Core pedagogical slots per objective (Explanation, Example, Revision)
    for obj in supported_objectives:
        pos += 1
        s_exp = Slot(
            unit_id=unit.id,
            objective_id=obj.id,
            type="explanation",
            position=pos,
            difficulty=unit.difficulty,
            bloom_tag=obj.bloom_target or "Understand",
        )
        slots_to_create.append(s_exp)

        pos += 1
        s_ex = Slot(
            unit_id=unit.id,
            objective_id=obj.id,
            type="example",
            position=pos,
            difficulty=unit.difficulty,
            bloom_tag="Apply",
        )
        slots_to_create.append(s_ex)

        pos += 1
        s_rev = Slot(
            unit_id=unit.id,
            objective_id=obj.id,
            type="revision",
            position=pos,
            difficulty=unit.difficulty,
            bloom_tag="Understand",
        )
        slots_to_create.append(s_rev)

    # 2b. Quiz items distribution
    num_supported = len(supported_objectives)
    total_quiz = max(num_supported, unit.quiz_count)
    for i in range(total_quiz):
        pos += 1
        obj = supported_objectives[i % num_supported]
        s_quiz = Slot(
            unit_id=unit.id,
            objective_id=obj.id,
            type="quiz_item",
            position=pos,
            difficulty=unit.difficulty,
            bloom_tag=get_bloom_target_for_difficulty(unit.difficulty, obj.bloom_target),
        )
        slots_to_create.append(s_quiz)

    # 2c. Practice Foundation items (5 items)
    total_foundation = max(5, num_supported)
    for i in range(total_foundation):
        pos += 1
        obj = supported_objectives[i % num_supported]
        s_found = Slot(
            unit_id=unit.id,
            objective_id=obj.id,
            type="practice_foundation",
            position=pos,
            difficulty="easy",
            bloom_tag="Remember",
        )
        slots_to_create.append(s_found)

    # 2d. Practice Advanced items (5 items)
    total_advanced = max(5, num_supported)
    for i in range(total_advanced):
        pos += 1
        obj = supported_objectives[i % num_supported]
        s_adv = Slot(
            unit_id=unit.id,
            objective_id=obj.id,
            type="practice_advanced",
            position=pos,
            difficulty="advanced",
            bloom_tag="Analyze",
        )
        slots_to_create.append(s_adv)

    # Persist Slots and empty Assets
    for s in slots_to_create:
        db.add(s)
        db.flush()
        asset = Asset(
            slot_id=s.id,
            status="draft",
            locked=False,
            current_version_id=None,
        )
        db.add(asset)

    unit.status = "planning"
    db.commit()

    # Build response summary
    blueprint_summary = []
    for s in slots_to_create:
        blueprint_summary.append({
            "slot_id": s.id,
            "objective_id": s.objective_id,
            "type": s.type,
            "position": s.position,
            "difficulty": s.difficulty,
            "bloom_tag": s.bloom_tag,
        })

    return {
        "unit_id": unit.id,
        "status": "planned",
        "total_objectives": len(objectives),
        "supported_objectives_count": len(supported_objectives),
        "unsupported_objectives_count": len(unsupported_objectives),
        "unsupported_details": [
            {"id": o.id, "text": o.text, "reason": o.support_note} for o in unsupported_objectives
        ],
        "slots_count": len(slots_to_create),
        "blueprint": blueprint_summary,
    }
