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
    actual_word_count: Optional[int] = Field(
        default=None, description="Actual word count of explanatory body (summary + sentences)."
    )
    target_word_count: Optional[int] = Field(
        default=None, description="Requested target word count."
    )
    insufficient_evidence_note: Optional[str] = Field(
        default=None, description="Note if source evidence was insufficient to reach requested word count."
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

def count_explanation_words(content_dict: Dict[str, Any], include_glossary: bool = False) -> int:
    """
    Count actual instructional words in an explanation asset.
    By default (include_glossary=False), strictly counts the explanatory body:
    conceptual summary + instructional sentence texts.
    Excludes title, glossary, source quotes, and evidence metadata per pedagogical word-count standards.
    If include_glossary=True, also includes glossary terms and definitions.
    """
    if not isinstance(content_dict, dict):
        return 0
    tokens: List[str] = []
    summary = content_dict.get("summary", "")
    if summary and isinstance(summary, str):
        tokens.extend(summary.split())
    for s in content_dict.get("sentences", []):
        if isinstance(s, dict):
            t = s.get("text", "")
            if t and isinstance(t, str):
                tokens.extend(t.split())
    if include_glossary:
        for g in content_dict.get("glossary", []):
            if isinstance(g, dict):
                term = g.get("term", "")
                defn = g.get("definition", "")
                if term and isinstance(term, str):
                    tokens.extend(term.split())
                if defn and isinstance(defn, str):
                    tokens.extend(defn.split())
    return len(tokens)


def is_placeholder_or_invalid_question(content_dict: Dict[str, Any], objective_text: str) -> Tuple[bool, str]:
    """Check if generated assessment item contains forbidden placeholders or objective-as-question copies."""
    if not isinstance(content_dict, dict):
        return False, ""

    question = content_dict.get("question", "").strip()
    if question:
        clean_obj = objective_text.strip().lower()
        clean_q = question.lower()
        
        # Check 1: Objective copied as question
        if clean_obj in clean_q and ("according to the source text regarding" in clean_q or len(clean_q) < len(clean_obj) + 60):
            return True, "Question wraps the objective statement instead of asking a direct subject question."

        # Check 2: Forbidden generic placeholder phrases in question or options
        forbidden_phrases = [
            "contradictory claim unsupported",
            "unsupported by the source text",
            "alternative mechanism not described",
            "outdated hypothesis regarding",
            "not described in the provided source",
            "placeholder option",
        ]
        for fp in forbidden_phrases:
            if fp in clean_q:
                return True, f"Question contains placeholder phrase: '{fp}'"

        options = content_dict.get("options", [])
        for opt in options:
            if isinstance(opt, str):
                for fp in forbidden_phrases:
                    if fp in opt.lower():
                        return True, f"Option contains placeholder phrase: '{fp}'"
                if opt.strip().lower() == clean_obj:
                    return True, "Option copies the learning objective statement."

    return False, ""


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
    - Enforces teacher constraints (e.g. max_words for explanations).
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
    top_k_chunks = 5
    if slot.type == "explanation":
        raw_mw_check = (unit.constraints or {}).get("max_words") or (unit.constraints or {}).get("max_explanation_words")
        if raw_mw_check:
            try:
                if int(raw_mw_check) >= 150:
                    top_k_chunks = max(6, min(10, len(source_version.chunks)))
            except (ValueError, TypeError):
                pass
    relevant_chunks = score_chunks_for_query(f"{objective.text} {slot.type}", source_version.chunks, top_k=top_k_chunks)
    source_block = build_source_block(relevant_chunks)

    # 2. Retrieve already-generated questions across the unit to prevent duplication
    existing_questions = []
    other_unit_slots = (
        db.query(Slot)
        .filter(Slot.unit_id == unit.id, Slot.id != slot.id)
        .order_by(Slot.position)
        .all()
    )
    for o_slot in other_unit_slots:
        if o_slot.asset and o_slot.asset.current_version and o_slot.asset.current_version.content:
            c = o_slot.asset.current_version.content
            if isinstance(c, dict) and c.get("question"):
                existing_questions.append(
                    f"- Slot #{o_slot.position} ({o_slot.type} | Obj: \"{o_slot.objective.text[:45]}...\"): \"{c['question']}\""
                )

    anti_dup_guidance = ""
    if existing_questions:
        anti_dup_guidance = (
            "CRITICAL ANTI-DUPLICATION RULE:\n"
            "The following questions ALREADY exist in this unit. You MUST NOT duplicate, paraphrase, or test the exact same scenario as any of them:\n"
            + "\n".join(existing_questions)
            + "\nEnsure your question tests a completely DIFFERENT concept, mechanism, calculation, or pedagogical angle."
        )

    bloom_guidance = get_bloom_prompt_instruction(slot.bloom_tag, slot.difficulty)

    anti_placeholder_rules = (
        "MANDATORY QUESTION & OPTION AUTHENTICITY RULES:\n"
        "1. Direct Subject Question: Formulate a natural, direct question testing specific concepts from the source material.\n"
        "2. NEVER copy or wrap the objective text (e.g. NEVER write 'According to the source text regarding [objective]...').\n"
        "3. NEVER use generic placeholder options (e.g. NEVER write 'Contradictory claim unsupported...', 'Alternative mechanism not described...', 'Outdated hypothesis...').\n"
        "4. All 4 options must be realistic, substantive domain statements.\n"
        "5. Distribute the correct answer across indices 0, 1, 2, or 3."
    )

    # 3. Build Prompt & Select Schema
    prompt_version = "1.0"
    base_instructions = (
        f"{source_block}\n\n"
        f"Unit Grade: {unit.target_grade} | Unit Difficulty: {unit.difficulty} | Language: {unit.language}\n"
        f"Target Objective: \"{objective.text}\"\n"
        f"Slot Type: {slot.type} | Difficulty: {slot.difficulty} | Bloom Target: {slot.bloom_tag}\n"
        f"{bloom_guidance}\n\n"
        f"{anti_placeholder_rules}\n\n"
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

    # Check for teacher-defined max_words constraint
    max_words_constraint: Optional[int] = None
    if unit.constraints and isinstance(unit.constraints, dict):
        raw_mw = unit.constraints.get("max_words") or unit.constraints.get("max_explanation_words")
        if raw_mw is not None:
            try:
                max_words_constraint = int(raw_mw)
            except (ValueError, TypeError):
                pass

    schema_type: Type[BaseModel]
    if slot.type == "explanation":
        schema_type = ExplanationContent
        if max_words_constraint and max_words_constraint > 0:
            target_min = int(max_words_constraint * 0.90)
            target_max = max_words_constraint

            if max_words_constraint <= 75:
                summary_hint = "concise conceptual summary (approx 20–30 words)"
                sentences_hint = "3–5 instructional sentences (each 8–15 words)"
            elif max_words_constraint <= 130:
                summary_hint = "focused conceptual summary (approx 25–40 words)"
                sentences_hint = "4–6 detailed instructional sentences (each 12–18 words)"
            elif max_words_constraint <= 220:
                summary_hint = "rich multi-sentence conceptual summary (approx 40–55 words)"
                sentences_hint = "7–10 detailed instructional sentences (each 15–25 words)"
            else:
                summary_hint = "in-depth conceptual summary (approx 50–70 words)"
                sentences_hint = "10–15 detailed instructional sentences (each 18–25 words)"

            length_clause = (
                f"\nMANDATORY EXPLANATION WORD COUNT TARGET ({max_words_constraint} WORDS):\n"
                f"Write an evidence-grounded explanation of approximately {max_words_constraint} words. "
                f"Aim for 90–100% of the requested word count ({target_min}–{target_max} words) while using only supported source evidence.\n"
                f"- The word count target applies strictly to the EXPLANATORY BODY: introductory summary + instructional sentence texts (excluding title, glossary terms/definitions, and source quotes).\n"
                f"- Summary: Provide a {summary_hint} thoroughly introducing the topic.\n"
                f"- Sentences: Provide {sentences_hint} to thoroughly cover the source material and achieve the {target_min}–{target_max} word target.\n"
                f"- Upper Bound: Total explanatory body (summary + sentences) MUST NOT exceed {target_max} words.\n"
                f"- Evidence Grounding: Every sentence MUST carry a verbatim quote from the source text above. Do NOT invent facts or extrapolate beyond the source.\n"
                f"- Insufficient Evidence Rule: If the available source evidence contains insufficient facts to safely produce ~{max_words_constraint} words without hallucinating, generate the maximum useful evidence-supported explanation without repeating sentences.\n"
            )
            prompt = (
                f"{base_instructions}\n\n"
                f"{length_clause}\n"
                f"Generate an Evidence-Locked Explanation strictly teaching '{objective.text}'.\n"
                f"Include a title, the conceptual summary, instructional sentences each with a verbatim quote, "
                f"and a glossary of key terms with definitions and verbatim quotes."
            )
        else:
            prompt = (
                f"{base_instructions}\n\n"
                f"Generate an Evidence-Locked Explanation strictly teaching '{objective.text}'.\n"
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
    elif slot.type == "quiz_item":
        schema_type = QuizItemContent
        prompt = (
            f"{base_instructions}\n\n"
            f"{anti_dup_guidance}\n\n"
            f"FORMATIVE ASSESSMENT QUIZ ITEM REQUIREMENTS:\n"
            f"Generate a distinctive Multiple-Choice Quiz Item evaluating mastery of: '{objective.text}'.\n"
            f"- Question: Must directly assess understanding of '{objective.text}'. Must NOT leak the answer.\n"
            f"- Options: Exactly 4 distinct, plausible choices (1 correct, 3 distractors).\n"
            f"- Correct Answer Index: 0-3.\n"
            f"- Rationale: Pedagogical explanation of why the correct option is right and distractors are wrong.\n"
            f"- Evidence Quote: Verbatim quote from the source supporting the correct answer.\n"
            f"- Bloom Tag: '{slot.bloom_tag}' | Difficulty: '{slot.difficulty}'."
        )
    elif slot.type == "practice_foundation":
        schema_type = QuizItemContent
        prompt = (
            f"{base_instructions}\n\n"
            f"{anti_dup_guidance}\n\n"
            f"FOUNDATION PRACTICE ITEM REQUIREMENTS (Introductory Mastery):\n"
            f"Generate an introductory FOUNDATION Practice Question evaluating: '{objective.text}'.\n"
            f"- Pedagogical Focus: Test fundamental understanding, core terminology, direct conceptual definitions, or simple single-step problem solving.\n"
            f"- Level: Accessible and confidence-building for students learning '{objective.text}'.\n"
            f"- Distinctness: Must NOT duplicate any quiz items or advanced practice questions.\n"
            f"- Options: Exactly 4 distinct choices (1 correct, 3 plausible distractors).\n"
            f"- Correct Answer Index: 0-3.\n"
            f"- Rationale: Clear, encouraging step-by-step foundational explanation.\n"
            f"- Evidence Quote: Verbatim quote from the source supporting the correct answer.\n"
            f"- Bloom Tag: '{slot.bloom_tag or 'Understand'}' | Difficulty: 'easy'."
        )
    elif slot.type == "practice_advanced":
        schema_type = QuizItemContent
        prompt = (
            f"{base_instructions}\n\n"
            f"{anti_dup_guidance}\n\n"
            f"ADVANCED PRACTICE ITEM REQUIREMENTS (Analytical Depth & Rigor):\n"
            f"Generate an ADVANCED Practice Question evaluating: '{objective.text}'.\n"
            f"- Pedagogical Focus: Test higher-order analytical reasoning, multi-step calculation, comparative trade-offs between techniques, or evaluating complex edge-case scenarios.\n"
            f"- Level: Challenging and intellectually rigorous, requiring deep reasoning beyond simple recall.\n"
            f"- Distinctness: Must NOT ask simple definitions or duplicate foundation practice.\n"
            f"- Options: Exactly 4 distinct, nuanced choices (1 correct, 3 rigorous distractors).\n"
            f"- Correct Answer Index: 0-3.\n"
            f"- Rationale: In-depth analytical rationale dissecting misconceptions and complex reasoning.\n"
            f"- Evidence Quote: Verbatim quote from the source supporting the correct answer.\n"
            f"- Bloom Tag: '{slot.bloom_tag or 'Analyze'}' | Difficulty: 'advanced'."
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

    # 4a. Explanation Word Target Validation & Revision Loop
    if slot.type == "explanation" and max_words_constraint and max_words_constraint > 0:
        target_min = int(max_words_constraint * 0.90)
        target_max = max_words_constraint
        actual_words = count_explanation_words(content_dict)
        source_words = sum(len(c.text.split()) for c in relevant_chunks)

        for retry_idx in range(2):
            if target_min <= actual_words <= target_max:
                break
            if actual_words < target_min and source_words < target_min:
                break

            if actual_words > target_max:
                retry_prompt = (
                    f"{prompt}\n\n"
                    f"REVISION REQUIRED (WORD LIMIT EXCEEDED):\n"
                    f"Your previous explanation contained {actual_words} words, which exceeds the teacher's limit of {target_max} words.\n"
                    f"Rewrite and compress the explanation body (summary + sentences) to be between {target_min} and {target_max} total words while retaining accurate sentences and source quotes."
                )
            else:
                retry_prompt = (
                    f"{prompt}\n\n"
                    f"REVISION REQUIRED (WORD COUNT TARGET NOT MET):\n"
                    f"The teacher requested an explanation of approximately {max_words_constraint} words (target range: {target_min}–{target_max} words).\n"
                    f"Your previous explanation body had only {actual_words} words, which is substantially below the requested target.\n"
                    f"Please expand the explanation by adding more detailed instructional sentences and expanding the conceptual summary using the provided source evidence.\n"
                    f"Aim for {target_min}–{target_max} words in the explanatory body while keeping every claim strictly evidence-locked with verbatim quotes.\n"
                    f"Do NOT invent facts or duplicate existing sentences."
                )

            try:
                retry_parsed, retry_meta = generate_json(
                    prompt=retry_prompt,
                    schema=schema_type,
                    temperature=0.2,
                    prompt_version=prompt_version,
                )
                retry_dict = retry_parsed.model_dump()
                new_words = count_explanation_words(retry_dict)
                if (target_min <= new_words <= target_max) or (actual_words < target_min and new_words > actual_words and new_words <= target_max) or (actual_words > target_max and new_words < actual_words):
                    content_dict = retry_dict
                    meta = retry_meta
                    actual_words = new_words
            except Exception:
                pass

    # 4b. In-flight duplicate detection and re-generation
    if slot.type in ["quiz_item", "practice_foundation", "practice_advanced"]:
        from rapidfuzz import fuzz
        gen_question = content_dict.get("question", "").strip()
        is_dup = False
        dup_match = ""
        for o_slot in other_unit_slots:
            if o_slot.asset and o_slot.asset.current_version and o_slot.asset.current_version.content:
                prev_q = o_slot.asset.current_version.content.get("question", "").strip()
                if prev_q:
                    jaccard = len(set(gen_question.lower().split()).intersection(set(prev_q.lower().split()))) / max(1, len(set(gen_question.lower().split()).union(set(prev_q.lower().split()))))
                    ratio = fuzz.ratio(gen_question.lower(), prev_q.lower()) / 100.0
                    tok_set = fuzz.token_set_ratio(gen_question.lower(), prev_q.lower()) / 100.0
                    if jaccard >= 0.60 or ratio >= 0.75 or tok_set >= 0.80:
                        is_dup = True
                        dup_match = prev_q
                        break

        if is_dup:
            retry_prompt = (
                f"{prompt}\n\n"
                f"RETRY REQUIRED: Your previous attempt generated a question too similar to: \"{dup_match}\".\n"
                f"Generate a COMPLETELY DIFFERENT question testing a distinct aspect of '{objective.text}'."
            )
            try:
                retry_content, retry_meta = generate_json(
                    prompt=retry_prompt,
                    schema=schema_type,
                    temperature=0.6,
                    prompt_version=prompt_version,
                )
                content_dict = retry_content.model_dump()
            except Exception:
                pass

    # 4c. Anti-Placeholder and Objective-as-Question Validation & Re-generation
    if slot.type in ["quiz_item", "practice_foundation", "practice_advanced"]:
        is_invalid, invalid_reason = is_placeholder_or_invalid_question(content_dict, objective.text)
        if is_invalid:
            retry_prompt = (
                f"{prompt}\n\n"
                f"RETRY REQUIRED (INVALID PLACEHOLDER CONTENT DETECTED):\n"
                f"Reason: {invalid_reason}\n"
                f"STRICT RULES:\n"
                f"1. Formulate a DIRECT subject question testing specific concepts from the source (e.g. 'What causes the convoy effect?').\n"
                f"2. Do NOT copy the objective statement or use meta-questions.\n"
                f"3. Generate 4 realistic, subject-matter options without generic placeholder phrases."
            )
            try:
                retry_content, retry_meta = generate_json(
                    prompt=retry_prompt,
                    schema=schema_type,
                    temperature=0.5,
                    prompt_version=prompt_version,
                )
                candidate_dict = retry_content.model_dump()
                still_invalid, _ = is_placeholder_or_invalid_question(candidate_dict, objective.text)
                if not still_invalid:
                    content_dict = candidate_dict
                    meta = retry_meta
            except Exception:
                pass

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

    if slot.type == "explanation" and max_words_constraint and max_words_constraint > 0:
        exp_words = count_explanation_words(content_dict)
        target_min = int(max_words_constraint * 0.90)
        source_words = sum(len(c.text.split()) for c in relevant_chunks)

        content_dict["actual_word_count"] = exp_words
        content_dict["target_word_count"] = max_words_constraint

        if exp_words > max_words_constraint:
            flag = QualityFlag(
                unit_id=unit.id,
                asset_version_id=asset_version.id,
                code="word_limit_exceeded",
                severity="warning",
                message=f"Explanation contains {exp_words} words, exceeding configured maximum of {max_words_constraint} words.",
            )
            db.add(flag)
            asset.status = "needs_revision"
        elif exp_words < target_min:
            if source_words < max_words_constraint:
                content_dict["insufficient_evidence_note"] = (
                    f"Source evidence was insufficient to safely produce {max_words_constraint} words without hallucination. "
                    f"Generated maximum evidence-supported explanation ({exp_words} words)."
                )
                flag = QualityFlag(
                    unit_id=unit.id,
                    asset_version_id=asset_version.id,
                    code="insufficient_evidence_for_word_target",
                    severity="info",
                    message=f"Source evidence contains limited text for this objective ({source_words} words in relevant chunks). Explanation produced maximum supported length ({exp_words} words of {max_words_constraint} requested).",
                )
                db.add(flag)
            else:
                flag = QualityFlag(
                    unit_id=unit.id,
                    asset_version_id=asset_version.id,
                    code="word_count_below_target",
                    severity="warning",
                    message=f"Explanation body contains {exp_words} words, below the requested target of {max_words_constraint} words ({target_min}-{max_words_constraint} target range).",
                )
                db.add(flag)

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

    # Pre-generation validation: ensure unit objectives are valid and slots reference only current unit objectives
    unit_objectives = unit.objectives
    if not unit_objectives:
        raise ValueError(f"Unit {unit_id} has no learning objectives configured.")

    valid_objective_ids = {obj.id for obj in unit_objectives}

    for s in slots:
        if s.unit_id != unit.id:
            raise ValueError(f"Slot {s.id} belongs to unit {s.unit_id}, but generation requested for unit {unit.id}.")
        if s.objective_id not in valid_objective_ids:
            raise ValueError(
                f"Slot {s.id} references objective ID {s.objective_id} which does not belong to unit {unit.id} (valid IDs: {valid_objective_ids})."
            )
        if not s.objective or s.objective.unit_id != unit.id:
            raise ValueError(f"Slot {s.id} is linked to a non-existent or foreign objective record.")

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

    import concurrent.futures
    from db.database import SessionLocal

    def _worker_process_slot(slot_id: int) -> Tuple[str, Optional[str]]:
        thread_db = SessionLocal()
        try:
            slot = thread_db.query(Slot).filter(Slot.id == slot_id).first()
            if not slot:
                return "failed", "Slot not found"
            asset = slot.asset
            if asset and asset.current_version_id and asset.status in ["draft", "approved", "needs_revision"]:
                return "skipped", None
            generate_slot(slot, thread_db)
            return "generated", None
        except Exception as e:
            try:
                slot = thread_db.query(Slot).filter(Slot.id == slot_id).first()
                if slot and slot.asset:
                    slot.asset.status = "generation_failed"
                    flag = QualityFlag(
                        unit_id=slot.unit_id,
                        code="generation_failed",
                        severity="error",
                        message=f"Slot {slot.id} ({slot.type}) failed: {str(e)}",
                    )
                    thread_db.add(flag)
                    thread_db.commit()
            except Exception:
                pass
            return "failed", str(e)
        finally:
            thread_db.close()

    slots_to_generate = []
    for slot in sorted_slots:
        asset = slot.asset
        if asset and asset.current_version_id and asset.status in ["draft", "approved", "needs_revision"]:
            skipped_count += 1
        else:
            slots_to_generate.append(slot.id)

    if slots_to_generate:
        max_workers = min(4, len(slots_to_generate))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_slot = {executor.submit(_worker_process_slot, sid): sid for sid in slots_to_generate}
            for future in concurrent.futures.as_completed(future_to_slot):
                outcome, _ = future.result()
                if outcome == "generated":
                    generated_count += 1
                elif outcome == "skipped":
                    skipped_count += 1
                else:
                    failed_count += 1

    db.expire_all()
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if unit:
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
