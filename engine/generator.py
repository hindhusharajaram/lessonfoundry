import json
from typing import Any, Dict, List, Optional, Tuple, Type
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.models import (
    Asset,
    AssetVersion,
    Claim,
    Objective,
    QualityFlag,
    Slot,
    SourceChunk,
    Unit,
)
from engine.bloom import get_bloom_prompt_instruction
from engine.model import (
    ModelError,
    build_source_block,
    generate_json,
)
from engine.planner import score_chunks_for_query
from engine.verifier import verify_quote


# ==========================================
# Spec Pydantic Content Schemas
# ==========================================

class SentenceClaim(BaseModel):
    text: str = Field(description="Clear instructional sentence.")
    quote: str = Field(description="Verbatim exact quote from the source text supporting this claim.")


class GlossaryItem(BaseModel):
    term: str = Field(description="Key scientific or academic term.")
    definition: str = Field(description="Definition explained clearly in student-accessible language.")
    quote: str = Field(description="Verbatim exact quote from the source text where this term/concept appears.")


class ExplanationContent(BaseModel):
    title: str = Field(description="Descriptive concept title.")
    summary: str = Field(description="High-level introductory summary.")
    sentences: List[SentenceClaim] = Field(
        min_length=3, description="List of evidence-backed instructional sentences."
    )
    glossary: List[GlossaryItem] = Field(
        min_length=1, description="List of essential vocabulary definitions with verbatim quotes."
    )


class StepClaim(BaseModel):
    text: str = Field(description="Instructional step or reasoning move.")
    quote: str = Field(description="Verbatim quote from the source supporting this reasoning step.")


class ExampleContent(BaseModel):
    problem: str = Field(description="Concrete problem or scenario to solve.")
    steps: List[StepClaim] = Field(min_length=2, description="Step-by-step worked solution.")
    answer: str = Field(description="Final clear conclusion or answer.")


class QuizItemContent(BaseModel):
    question: str = Field(description="Multiple-choice question text. Must NOT leak the correct answer.")
    options: List[str] = Field(
        min_length=4, max_length=4, description="Exactly 4 plausible options (1 correct, 3 distractors)."
    )
    correct_index: int = Field(
        ge=0, le=3, description="0-indexed position of the correct answer in options array."
    )
    rationale: str = Field(description="Pedagogical explanation of why the correct option is right and others wrong.")
    quote: str = Field(description="Verbatim quote from source text supporting the correct answer.")
    bloom: str = Field(description="Target Bloom level (e.g., Remember, Understand, Apply, Analyze, Evaluate).")
    difficulty: str = Field(description="Difficulty level (easy, medium, advanced).")


class KeyPointItem(BaseModel):
    text: str = Field(description="Core summary takeaway point.")
    quote: str = Field(description="Verbatim quote from the source text.")
    objective_id: int = Field(description="The objective ID this key point aligns with.")


class RevisionContent(BaseModel):
    key_points: List[KeyPointItem] = Field(min_length=2, description="List of high-yield summary points.")
    terms: List[GlossaryItem] = Field(min_length=1, description="Essential review terms and definitions.")


# ==========================================
# Generation Helpers & Pipeline
# ==========================================

def _extract_claims_from_content(content_dict: Dict[str, Any], slot_type: str) -> List[Tuple[str, str]]:
    """Extract all (text_claim, source_quote) pairs from generated content dict."""
    claims: List[Tuple[str, str]] = []
    
    if slot_type == "explanation":
        for s in content_dict.get("sentences", []):
            if s.get("text") and s.get("quote"):
                claims.append((s["text"], s["quote"]))
        for g in content_dict.get("glossary", []):
            if g.get("definition") and g.get("quote"):
                claims.append((f"{g.get('term')}: {g['definition']}", g["quote"]))

    elif slot_type == "example":
        for st in content_dict.get("steps", []):
            if st.get("text") and st.get("quote"):
                claims.append((st["text"], st["quote"]))

    elif slot_type in ["quiz_item", "practice_foundation", "practice_advanced"]:
        q = content_dict.get("quote")
        question = content_dict.get("question", "")
        if q and question:
            claims.append((question, q))

    elif slot_type == "revision":
        for kp in content_dict.get("key_points", []):
            if kp.get("text") and kp.get("quote"):
                claims.append((kp["text"], kp["quote"]))
        for t in content_dict.get("terms", []):
            if t.get("definition") and t.get("quote"):
                claims.append((f"{t.get('term')}: {t['definition']}", t["quote"]))

    return claims


def generate_slot(
    slot: Slot,
    db: Session,
    feedback: Optional[str] = None,
    parent_version: Optional[AssetVersion] = None,
) -> AssetVersion:
    """
    Generate or regenerate content for a single Slot.
    - Locks untrusted source text into boundary delimiters.
    - Generates strictly structured JSON matching spec schemas.
    - Validates quotes with non-LLM verifier.
    - Creates Claim rows and stores complete AssetVersion provenance.
    """
    unit = slot.unit
    source_version = unit.pinned_source_version
    if not source_version or not source_version.chunks:
        raise ValueError("Source version or chunks missing for unit.")

    objective = slot.objective
    if not objective or not objective.supported:
        raise ValueError(f"Slot {slot.id} has no supported objective.")

    # 1. Retrieve most relevant source chunks for this objective
    relevant_chunks = score_chunks_for_query(f"{objective.text} {slot.type}", source_version.chunks, top_k=5)
    source_block = build_source_block(relevant_chunks)

    # 2. Retrieve already-generated related content for context/consistency
    related_context = []
    sibling_slots = (
        db.query(Slot)
        .filter(Slot.unit_id == unit.id, Slot.objective_id == objective.id, Slot.id != slot.id)
        .all()
    )
    for sib in sibling_slots:
        if sib.asset and sib.asset.current_version:
            related_context.append(
                f"- Related {sib.type}: {json.dumps(sib.asset.current_version.content)}"
            )

    context_str = "\n".join(related_context) if related_context else "None yet."

    bloom_guidance = get_bloom_prompt_instruction(slot.bloom_tag, slot.difficulty)

    # 3. Build Prompt & Select Schema
    prompt_version = "1.0"
    base_instructions = (
        f"{source_block}\n\n"
        f"Unit Grade: {unit.target_grade} | Unit Difficulty: {unit.difficulty} | Language: {unit.language}\n"
        f"Target Objective: \"{objective.text}\"\n"
        f"Slot Type: {slot.type} | Difficulty: {slot.difficulty} | Bloom Target: {slot.bloom_tag}\n"
        f"{bloom_guidance}\n\n"
        f"Prior Objective Context:\n{context_str}\n\n"
        f"Mandatory Evidence Rules:\n"
        f"1. Every single sentence, step, key point, or question MUST carry a verbatim exact quote from the source text above.\n"
        f"2. NO FLASHCARDS anywhere in output.\n"
        f"3. Do NOT invent or extrapolate facts not present in the source."
    )

    if feedback:
        base_instructions += (
            f"\n\nCRITICAL TEACHER REVISION FEEDBACK TO INCORPORATE:\n"
            f"The teacher reviewed the prior version and explicitly requested the following changes:\n"
            f"\"{feedback}\"\n"
            f"You MUST directly address this teacher feedback in your generation while maintaining strict evidence grounding."
        )

    schema_type: Type[BaseModel]
    if slot.type == "explanation":
        schema_type = ExplanationContent
        prompt = (
            f"{base_instructions}\n\n"
            f"Generate an Evidence-Locked Explanation for '{objective.text}'.\n"
            f"Include a title, summary, 3-5 instructional sentences each with a verbatim quote, "
            f"and a glossary of key terms with definitions and verbatim quotes."
        )
    elif slot.type == "example":
        schema_type = ExampleContent
        prompt = (
            f"{base_instructions}\n\n"
            f"Generate a Worked Example demonstrating '{objective.text}'.\n"
            f"Include a problem scenario, 2-4 step-by-step reasoning steps each with a verbatim quote, and a final answer."
        )
    elif slot.type in ["quiz_item", "practice_foundation", "practice_advanced"]:
        schema_type = QuizItemContent
        prompt = (
            f"{base_instructions}\n\n"
            f"Generate a Multiple-Choice Question for '{objective.text}'.\n"
            f"Options must have exactly 4 plausible choices with 1 correct_index (0-3).\n"
            f"The question text must NOT leak or give away the answer.\n"
            f"Include a rationale, the verbatim quote supporting the correct answer, bloom tag ('{slot.bloom_tag}'), and difficulty ('{slot.difficulty}')."
        )
    elif slot.type == "revision":
        schema_type = RevisionContent
        prompt = (
            f"{base_instructions}\n\n"
            f"Generate a Revision Summary for '{objective.text}'.\n"
            f"Include key summary points (with objective_id={objective.id} and verbatim quotes) and essential glossary review terms."
        )
    else:
        raise ValueError(f"Unknown slot type '{slot.type}'")

    # 4. Invoke Model
    parsed_content, meta = generate_json(
        prompt=prompt,
        schema=schema_type,
        temperature=0.2,
        prompt_version=prompt_version,
    )
    content_dict = parsed_content.model_dump()

    # Update slot bloom_tag if model returned a refined one
    if "bloom" in content_dict:
        slot.bloom_tag = content_dict["bloom"]

    # 5. Non-LLM Verifier on all extracted claims & quotes
    raw_claims = _extract_claims_from_content(content_dict, slot.type)
    verified_claims_count = 0
    verification_details = []

    # Get asset record
    asset = slot.asset
    if not asset:
        asset = Asset(slot_id=slot.id, status="draft", locked=False)
        db.add(asset)
        db.flush()

    new_version_no = (parent_version.version_no + 1) if parent_version else 1

    # Create AssetVersion
    asset_version = AssetVersion(
        asset_id=asset.id,
        version_no=new_version_no,
        parent_version_id=parent_version.id if parent_version else None,
        variant="standard",
        content=content_dict,
        model=meta.get("model", "gemini-2.5-flash"),
        prompt_version=prompt_version,
        settings={
            "difficulty": slot.difficulty,
            "bloom_tag": slot.bloom_tag,
            "target_grade": unit.target_grade,
            "constraints": unit.constraints,
        },
        source_version_id=source_version.id,
        source_sha256=source_version.sha256,
        verification={},  # Will update below
    )
    db.add(asset_version)
    db.flush()

    for claim_text, quote in raw_claims:
        ver_res = verify_quote(quote, source_version.chunks)
        if ver_res.verified:
            verified_claims_count += 1

        claim_row = Claim(
            asset_version_id=asset_version.id,
            text=claim_text,
            source_quote=quote,
            chunk_id=ver_res.chunk_id,
            char_start=ver_res.char_start,
            char_end=ver_res.char_end,
            verified=ver_res.verified,
            match_score=ver_res.match_score,
        )
        db.add(claim_row)

        verification_details.append({
            "quote": quote,
            "verified": ver_res.verified,
            "match_score": ver_res.match_score,
            "chunk_id": ver_res.chunk_id,
            "note": ver_res.note,
        })

    total_claims = len(raw_claims)
    all_verified = (verified_claims_count == total_claims) if total_claims > 0 else True
    verification_summary = {
        "total_claims": total_claims,
        "verified_claims": verified_claims_count,
        "verification_ratio": round(verified_claims_count / total_claims, 3) if total_claims > 0 else 1.0,
        "all_verified": all_verified,
        "details": verification_details,
    }
    asset_version.verification = verification_summary

    # Update Asset status
    asset.current_version_id = asset_version.id
    if not all_verified:
        asset.status = "needs_revision"
        flag = QualityFlag(
            unit_id=unit.id,
            asset_version_id=asset_version.id,
            code="unsupported_claim",
            severity="warning",
            message=f"Asset has {total_claims - verified_claims_count} unverified quote(s).",
        )
        db.add(flag)
        asset.status = "draft"

    db.commit()
    db.refresh(asset_version)

    # Run independent solver on assessment items
    if slot.type in ["quiz_item", "practice_foundation", "practice_advanced"]:
        from engine.solver import verify_asset_with_solver
        verify_asset_with_solver(slot, asset_version, db)

    return asset_version


def generate_unit_pack(unit_id: int, db: Session) -> Dict[str, Any]:
    """
    Generate all un-generated or failed slots for a unit in pedagogical sequence:
    1. Explanation slots
    2. Example slots
    3. Quiz & practice slots
    4. Revision slots
    Supports resuming without overwriting approved/locked/draft content.
    """
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise ValueError(f"Unit {unit_id} not found.")

    slots = db.query(Slot).filter(Slot.unit_id == unit_id).order_by(Slot.position).all()
    if not slots:
        raise ValueError("Unit has no slots. Run POST /api/units/{id}/plan first.")

    # Order slots pedagogically
    type_priority = {
        "explanation": 1,
        "example": 2,
        "quiz_item": 3,
        "practice_foundation": 4,
        "practice_advanced": 5,
        "revision": 6,
    }
    sorted_slots = sorted(slots, key=lambda s: (type_priority.get(s.type, 99), s.position))

    generated_count = 0
    failed_count = 0
    skipped_count = 0

    for slot in sorted_slots:
        asset = slot.asset
        # Resume rule: skip already generated unless failed or empty
        if asset and asset.current_version_id and asset.status in ["draft", "approved", "needs_revision"]:
            skipped_count += 1
            continue

        try:
            generate_slot(slot, db)
            generated_count += 1
        except ModelError as me:
            failed_count += 1
            if asset:
                asset.status = "generation_failed"
                flag = QualityFlag(
                    unit_id=unit.id,
                    code="generation_failed",
                    severity="error",
                    message=f"Slot {slot.id} ({slot.type}) failed generation: {str(me)}",
                )
                db.add(flag)
                db.commit()
        except Exception as e:
            failed_count += 1
            if asset:
                asset.status = "generation_failed"
                flag = QualityFlag(
                    unit_id=unit.id,
                    code="generation_failed",
                    severity="error",
                    message=f"Slot {slot.id} ({slot.type}) unexpected error: {str(e)}",
                )
                db.add(flag)
                db.commit()

    unit.status = "generated"
    db.commit()

    # Automatically execute guardrails across the unit
    from engine.guardrails import run_unit_guardrails
    run_unit_guardrails(unit.id, db)

    return {
        "unit_id": unit.id,
        "total_slots": len(slots),
        "generated_count": generated_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "status": unit.status,
    }
