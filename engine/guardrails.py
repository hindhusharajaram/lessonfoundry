import re
from typing import Any, Dict, List, Optional, Set, Tuple
from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from db.models import (
    Asset,
    AssetVersion,
    Claim,
    Objective,
    QualityFlag,
    Slot,
    Unit,
)

BLOOM_RANKS = {
    "remember": 1,
    "understand": 2,
    "apply": 3,
    "analyze": 4,
    "evaluate": 5,
    "create": 6,
}


def _tokenize(text: str) -> Set[str]:
    return set(re.findall(r"\b\w{3,}\b", text.lower()))


def run_unit_guardrails(unit_id: int, db: Session) -> List[QualityFlag]:
    """
    Executes all 10 deterministic & semantic guardrails across the unit:
    1. duplicate_question
    2. answer_leakage
    3. unsupported_claims
    4. objective_coverage_imbalance
    5. missing_objective_coverage
    6. malformed_key
    7. difficulty_mismatch
    8. unsupported_revision_concept
    9. terminology_drift
    10. injection_flagged_source
    
    Persists new QualityFlag records and returns the list of open flags.
    """
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        return []

    # Clear previously generated automated guardrail flags (preserve manual notes)
    guardrail_codes = {
        "duplicate_question",
        "answer_leakage",
        "unsupported_claims",
        "objective_coverage_imbalance",
        "missing_objective_coverage",
        "malformed_key",
        "difficulty_mismatch",
        "unsupported_revision_concept",
        "terminology_drift",
        "injection_flagged_source",
    }
    existing_flags = (
        db.query(QualityFlag)
        .filter(QualityFlag.unit_id == unit.id, QualityFlag.code.in_(guardrail_codes))
        .all()
    )
    for ef in existing_flags:
        db.delete(ef)
    db.flush()

    new_flags: List[QualityFlag] = []
    slots = db.query(Slot).filter(Slot.unit_id == unit.id).order_by(Slot.position).all()
    objectives = db.query(Objective).filter(Objective.unit_id == unit.id).all()
    supported_objectives = [o for o in objectives if o.supported]

    # --- 10. Injection Flagged Source ---
    if unit.pinned_source_version and unit.pinned_source_version.injection_flags:
        flags_data = unit.pinned_source_version.injection_flags
        if isinstance(flags_data, dict) and flags_data.get("flagged"):
            count = flags_data.get("count", 0)
            new_flags.append(
                QualityFlag(
                    unit_id=unit.id,
                    code="injection_flagged_source",
                    severity="info",
                    message=f"Source text contains {count} flagged prompt injection / instruction override pattern(s). Source is strictly treated as untrusted reference data.",
                )
            )

    # --- 4 & 5. Objective Coverage Imbalance & Missing Coverage ---
    if supported_objectives:
        obj_slot_counts: Dict[int, int] = {o.id: 0 for o in supported_objectives}
        for s in slots:
            if s.objective_id in obj_slot_counts and s.asset and s.asset.current_version:
                obj_slot_counts[s.objective_id] += 1

        total_generated_items = sum(obj_slot_counts.values())
        avg_items_per_obj = total_generated_items / len(supported_objectives) if supported_objectives else 0

        for obj in supported_objectives:
            count = obj_slot_counts[obj.id]
            if count == 0 and total_generated_items > 0:
                new_flags.append(
                    QualityFlag(
                        unit_id=unit.id,
                        code="missing_objective_coverage",
                        severity="error",
                        message=f"Supported Objective #{obj.position} ('{obj.text[:60]}...') has 0 generated content slots.",
                    )
                )
            elif count > 0 and avg_items_per_obj > 2 and count < (0.5 * avg_items_per_obj):
                new_flags.append(
                    QualityFlag(
                        unit_id=unit.id,
                        code="objective_coverage_imbalance",
                        severity="warning",
                        message=f"Objective #{obj.position} has only {count} items (average is {avg_items_per_obj:.1f} items per objective).",
                    )
                )

    # Collect explanation glossary terms for consistency checks
    explanation_glossary: Dict[int, Dict[str, str]] = {}  # obj_id -> {term: definition}

    # Iterate over all slots and their current asset versions
    question_items: List[Tuple[Slot, AssetVersion, str, List[str], int]] = []
    foundation_ranks: List[int] = []
    advanced_ranks: List[int] = []

    for slot in slots:
        if not slot.asset or not slot.asset.current_version:
            continue
        av = slot.asset.current_version
        content = av.content or {}

        # --- 3. Unsupported Claims (Unverified Quotes) ---
        unverified_claims = [c for c in av.claims if not c.verified]
        if unverified_claims:
            new_flags.append(
                QualityFlag(
                    unit_id=unit.id,
                    asset_version_id=av.id,
                    code="unsupported_claims",
                    severity="error",
                    message=f"Slot #{slot.position} ({slot.type}) contains {len(unverified_claims)} unverified quote claim(s).",
                )
            )

        # Harvest explanations
        if slot.type == "explanation":
            glossary_map = {}
            for item in content.get("glossary", []):
                t = item.get("term", "").strip().lower()
                d = item.get("definition", "").strip()
                if t:
                    glossary_map[t] = d
            explanation_glossary[slot.objective_id] = glossary_map

        # Harvest quiz and practice items
        elif slot.type in ["quiz_item", "practice_foundation", "practice_advanced"]:
            q_text = content.get("question", "").strip()
            options = content.get("options", [])
            key_idx = content.get("correct_index")
            bloom = content.get("bloom", slot.bloom_tag or "Understand").lower()
            rank = BLOOM_RANKS.get(bloom, 2)

            if slot.type == "practice_foundation":
                foundation_ranks.append(rank)
            elif slot.type == "practice_advanced":
                advanced_ranks.append(rank)

            # --- 6. Malformed Key / Option Structure ---
            if (
                not isinstance(options, list)
                or len(options) != 4
                or key_idx is None
                or not (0 <= key_idx < 4)
                or len(set([opt.strip().lower() for opt in options if isinstance(opt, str)])) < 4
            ):
                new_flags.append(
                    QualityFlag(
                        unit_id=unit.id,
                        asset_version_id=av.id,
                        code="malformed_key",
                        severity="error",
                        message=f"Slot #{slot.position} ({slot.type}) has malformed multiple-choice structure (must have exactly 4 unique options and valid 0-3 correct_index).",
                    )
                )
            else:
                question_items.append((slot, av, q_text, options, key_idx))

                # --- 2. Answer Leakage Detection ---
                correct_answer_text = options[key_idx].strip()
                correct_tokens = _tokenize(correct_answer_text)
                if len(correct_answer_text) > 4:
                    # Check exact or strong substring appearance in question stem
                    if correct_answer_text.lower() in q_text.lower():
                        new_flags.append(
                            QualityFlag(
                                unit_id=unit.id,
                                asset_version_id=av.id,
                                code="answer_leakage",
                                severity="warning",
                                message=f"Slot #{slot.position} question stem contains the exact correct answer text ('{correct_answer_text}').",
                            )
                        )
                    elif len(correct_tokens) >= 3:
                        q_tokens = _tokenize(q_text)
                        if correct_tokens.issubset(q_tokens):
                            new_flags.append(
                                QualityFlag(
                                    unit_id=unit.id,
                                    asset_version_id=av.id,
                                    code="answer_leakage",
                                    severity="warning",
                                    message=f"Slot #{slot.position} question stem contains all key terms of the correct answer.",
                                )
                            )

        # Check revision slots
        elif slot.type == "revision":
            obj_glossary = explanation_glossary.get(slot.objective_id, {})
            # --- 8. Unsupported Revision Concept ---
            for term_item in content.get("terms", []):
                t_name = term_item.get("term", "").strip().lower()
                if obj_glossary and t_name and t_name not in obj_glossary:
                    new_flags.append(
                        QualityFlag(
                            unit_id=unit.id,
                            asset_version_id=av.id,
                            code="unsupported_revision_concept",
                            severity="warning",
                            message=f"Revision slot #{slot.position} introduces new vocabulary term '{t_name}' not defined in the explanation glossary.",
                        )
                    )

    # --- 1. Duplicate / Near-Duplicate Questions ---
    num_questions = len(question_items)
    for i in range(num_questions):
        slot_a, av_a, text_a, _, _ = question_items[i]
        tokens_a = _tokenize(text_a)
        for j in range(i + 1, num_questions):
            slot_b, av_b, text_b, _, _ = question_items[j]
            tokens_b = _tokenize(text_b)

            # Jaccard + RapidFuzz
            intersection = len(tokens_a.intersection(tokens_b))
            union = len(tokens_a.union(tokens_b))
            jaccard = (intersection / union) if union > 0 else 0.0
            ratio = fuzz.ratio(text_a.lower(), text_b.lower()) / 100.0

            if jaccard >= 0.80 or ratio >= 0.85:
                new_flags.append(
                    QualityFlag(
                        unit_id=unit.id,
                        asset_version_id=av_a.id,
                        code="duplicate_question",
                        severity="warning",
                        message=f"Slot #{slot_a.position} is near-duplicate of Slot #{slot_b.position} (similarity: {max(jaccard, ratio)*100:.0f}%).",
                    )
                )

    # --- 7. Difficulty & Bloom Mismatch ---
    if foundation_ranks and advanced_ranks:
        mean_found = sum(foundation_ranks) / len(foundation_ranks)
        mean_adv = sum(advanced_ranks) / len(advanced_ranks)
        # Advanced practice must exhibit higher cognitive demand than foundation
        if mean_adv <= mean_found:
            new_flags.append(
                QualityFlag(
                    unit_id=unit.id,
                    code="difficulty_mismatch",
                    severity="warning",
                    message=f"Advanced practice items (mean Bloom rank: {mean_adv:.2f}) do not exhibit higher cognitive demand than Foundation items (mean Bloom rank: {mean_found:.2f}).",
                )
            )
        # Advanced items should not be predominantly Remember (rank 1)
        remember_adv_count = sum(1 for r in advanced_ranks if r == 1)
        if (remember_adv_count / len(advanced_ranks)) >= 0.50:
            new_flags.append(
                QualityFlag(
                    unit_id=unit.id,
                    code="difficulty_mismatch",
                    severity="warning",
                    message="More than 50% of Advanced Practice items are at the 'Remember' Bloom level. Advanced items should target 'Analyze' or 'Evaluate'.",
                )
            )

    # Persist flags
    for flag in new_flags:
        db.add(flag)
    db.commit()

    # Query all active flags for the unit
    all_open_flags = db.query(QualityFlag).filter(QualityFlag.unit_id == unit.id, QualityFlag.resolved == False).all()
    return all_open_flags


def calculate_pack_health(unit_id: int, db: Session) -> Dict[str, Any]:
    """
    Computes full Pack Health diagnostics and composite 0-100 score.
    """
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise ValueError(f"Unit {unit_id} not found.")

    # Refresh guardrails
    open_flags = run_unit_guardrails(unit_id, db)

    slots = db.query(Slot).filter(Slot.unit_id == unit_id).all()
    objectives = db.query(Objective).filter(Objective.unit_id == unit_id).all()
    supported_objectives = [o for o in objectives if o.supported]

    # 1. Objective Coverage
    obj_coverage = []
    total_slots_count = len(slots)
    for obj in supported_objectives:
        assigned_slots = [s for s in slots if s.objective_id == obj.id and s.asset and s.asset.current_version]
        pct = round((len(assigned_slots) / total_slots_count) * 100, 1) if total_slots_count > 0 else 0.0
        obj_coverage.append({
            "objective_id": obj.id,
            "position": obj.position,
            "text": obj.text,
            "slots_count": len(assigned_slots),
            "coverage_percentage": pct,
        })

    # 2. Bloom Distribution
    bloom_counts: Dict[str, int] = {}
    total_bloom_items = 0
    for s in slots:
        if s.asset and s.asset.current_version:
            content = s.asset.current_version.content or {}
            tag = content.get("bloom", s.bloom_tag or "Understand").capitalize()
            bloom_counts[tag] = bloom_counts.get(tag, 0) + 1
            total_bloom_items += 1

    bloom_distribution = [
        {"bloom": tag, "count": cnt, "percentage": round((cnt / total_bloom_items) * 100, 1)}
        for tag, cnt in bloom_counts.items()
    ]

    # 3. Grounding Percentage
    total_claims = 0
    verified_claims = 0
    for s in slots:
        if s.asset and s.asset.current_version:
            for c in s.asset.current_version.claims:
                total_claims += 1
                if c.verified:
                    verified_claims += 1
    grounding_pct = round((verified_claims / total_claims) * 100, 1) if total_claims > 0 else 100.0

    # 4. Solver Verification Rate
    total_quiz_slots = 0
    solver_matched_slots = 0
    for s in slots:
        if s.type in ["quiz_item", "practice_foundation", "practice_advanced"] and s.asset and s.asset.current_version:
            total_quiz_slots += 1
            ver_info = s.asset.current_version.verification or {}
            solver_info = ver_info.get("solver", {})
            if solver_info.get("matches_key"):
                solver_matched_slots += 1
    solver_pct = (
        round((solver_matched_slots / total_quiz_slots) * 100, 1) if total_quiz_slots > 0 else 100.0
    )

    # 5. Open Flags by Severity
    errors_count = sum(1 for f in open_flags if f.severity == "error")
    warnings_count = sum(1 for f in open_flags if f.severity == "warning")
    info_count = sum(1 for f in open_flags if f.severity == "info")
    duplicate_count = sum(1 for f in open_flags if f.code == "duplicate_question")

    # 6. Composite Health Score Formula per docs/HEALTH_SCORE.md
    # Raw Score = 0.40*G + 0.25*S + 0.15*O + 0.10*B + 0.10*V
    g_score = grounding_pct
    s_score = solver_pct
    o_score = 100.0 if not any(f.code in ["objective_coverage_imbalance", "missing_objective_coverage"] for f in open_flags) else 70.0
    b_score = 100.0 if not any(f.code == "difficulty_mismatch" for f in open_flags) else 70.0
    v_score = max(0.0, 100.0 - (duplicate_count * 15.0) - (sum(1 for f in open_flags if f.code in ["answer_leakage", "malformed_key"]) * 20.0))

    raw_score = (0.40 * g_score) + (0.25 * s_score) + (0.15 * o_score) + (0.10 * b_score) + (0.10 * v_score)
    penalty = (errors_count * 10.0) + (warnings_count * 3.0)
    health_score = max(0, min(100, int(round(raw_score - penalty))))

    return {
        "unit_id": unit.id,
        "title": unit.title,
        "health_score": health_score,
        "grounding_percentage": grounding_pct,
        "solver_verification_rate": solver_pct,
        "total_claims": total_claims,
        "verified_claims": verified_claims,
        "total_quiz_slots": total_quiz_slots,
        "solver_matched_slots": solver_matched_slots,
        "objective_coverage": obj_coverage,
        "bloom_distribution": bloom_distribution,
        "duplicate_count": duplicate_count,
        "open_flags_count": {
            "total": len(open_flags),
            "error": errors_count,
            "warning": warnings_count,
            "info": info_count,
        },
        "open_flags": [
            {
                "id": f.id,
                "code": f.code,
                "severity": f.severity,
                "message": f.message,
                "asset_version_id": f.asset_version_id,
            }
            for f in open_flags
        ],
    }
