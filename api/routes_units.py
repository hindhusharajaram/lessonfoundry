from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.deps import require_teacher
from db.database import get_db
from db.models import (
    Asset,
    AssetVersion,
    Claim,
    Objective,
    QualityFlag,
    Slot,
    Source,
    SourceVersion,
    Unit,
)
from engine.generator import generate_unit_pack
from engine.planner import plan_unit

router = APIRouter(prefix="/units", tags=["units"])


# ==========================================
# Request / Response Schemas
# ==========================================

class UnitCreateRequest(BaseModel):
    title: str
    source_id: int
    target_grade: str = "High School"
    difficulty: str = "medium"  # easy | medium | advanced
    language: str = "English"
    answer_visibility: str = "after_submission"
    constraints: Optional[Dict[str, Any]] = None
    quiz_count: int = 5


class ObjectiveInput(BaseModel):
    text: str
    bloom_target: Optional[str] = "Understand"


class UnitObjectivesUpdateRequest(BaseModel):
    objectives: List[ObjectiveInput]


# ==========================================
# Routes
# ==========================================

@router.post("", status_code=status.HTTP_201_CREATED)
def create_unit(
    req: UnitCreateRequest,
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """
    Create a new Unit and pin the latest SourceVersion of the specified source.
    """
    source = db.query(Source).filter(Source.id == req.source_id).first()
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source with id {req.source_id} not found.",
        )

    latest_version = (
        db.query(SourceVersion)
        .filter(SourceVersion.source_id == req.source_id)
        .order_by(SourceVersion.version_no.desc())
        .first()
    )

    if not latest_version:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Source {req.source_id} has no uploaded versions.",
        )

    valid_difficulties = ["easy", "medium", "advanced"]
    diff = req.difficulty.lower()
    if diff not in valid_difficulties:
        diff = "medium"

    unit = Unit(
        title=req.title,
        source_id=source.id,
        pinned_source_version_id=latest_version.id,
        target_grade=req.target_grade,
        difficulty=diff,
        language=req.language,
        answer_visibility=req.answer_visibility,
        constraints=req.constraints or {},
        quiz_count=req.quiz_count,
        status="draft",
    )
    db.add(unit)
    db.commit()
    db.refresh(unit)

    return {
        "unit_id": unit.id,
        "title": unit.title,
        "source_id": unit.source_id,
        "pinned_source_version_id": unit.pinned_source_version_id,
        "pinned_version_no": latest_version.version_no,
        "target_grade": unit.target_grade,
        "difficulty": unit.difficulty,
        "language": unit.language,
        "quiz_count": unit.quiz_count,
        "status": unit.status,
    }


@router.get("")
def list_units(
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    units = db.query(Unit).order_by(Unit.created_at.desc()).all()
    return {
        "units": [
            {
                "id": u.id,
                "title": u.title,
                "source_id": u.source_id,
                "status": u.status,
                "target_grade": u.target_grade,
                "difficulty": u.difficulty,
                "objectives_count": len(u.objectives),
                "slots_count": len(u.slots),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in units
        ]
    }


@router.get("/{unit_id}")
def get_unit_details(
    unit_id: int,
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unit {unit_id} not found.",
        )

    return {
        "id": unit.id,
        "title": unit.title,
        "source_id": unit.source_id,
        "pinned_source_version_id": unit.pinned_source_version_id,
        "target_grade": unit.target_grade,
        "difficulty": unit.difficulty,
        "language": unit.language,
        "answer_visibility": unit.answer_visibility,
        "constraints": unit.constraints,
        "quiz_count": unit.quiz_count,
        "status": unit.status,
        "objectives": [
            {
                "id": o.id,
                "position": o.position,
                "text": o.text,
                "bloom_target": o.bloom_target,
                "supported": o.supported,
                "support_note": o.support_note,
            }
            for o in unit.objectives
        ],
        "slots_count": len(unit.slots),
    }


@router.put("/{unit_id}/objectives")
def update_objectives(
    unit_id: int,
    body: Any = Body(...),
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """
    Set or replace objectives for a unit. Requires at least 2 objectives.
    Accepts either {"objectives": [...]} or a direct list of [{"text": ...}].
    """
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unit {unit_id} not found.",
        )

    raw_list = []
    if isinstance(body, list):
        raw_list = body
    elif isinstance(body, dict) and "objectives" in body:
        raw_list = body["objectives"]
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request body. Expected a list of objectives or an object with 'objectives' list.",
        )

    if len(raw_list) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 learning objectives are required.",
        )

    # Delete existing objectives (cascades to old slots/assets)
    for old_obj in unit.objectives:
        db.delete(old_obj)
    db.flush()

    new_objs = []
    for idx, item in enumerate(raw_list):
        text = item.get("text", "") if isinstance(item, dict) else getattr(item, "text", "")
        bloom = item.get("bloom_target", "Understand") if isinstance(item, dict) else getattr(item, "bloom_target", "Understand")
        if not text.strip():
            continue
        obj = Objective(
            unit_id=unit.id,
            position=idx + 1,
            text=text.strip(),
            bloom_target=bloom or "Understand",
            supported=True,
        )
        db.add(obj)
        new_objs.append(obj)

    if len(new_objs) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least 2 non-empty learning objectives are required.",
        )

    unit.status = "draft"
    db.commit()
    db.refresh(unit)

    return {
        "unit_id": unit.id,
        "objectives_count": len(unit.objectives),
        "objectives": [
            {
                "id": o.id,
                "position": o.position,
                "text": o.text,
                "bloom_target": o.bloom_target,
                "supported": o.supported,
            }
            for o in unit.objectives
        ],
    }


@router.post("/{unit_id}/plan")
def generate_plan(
    unit_id: int,
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """
    Run gap detection and generate the unit blueprint.
    Refuses generation for unsupported objectives.
    """
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unit {unit_id} not found.",
        )

    try:
        plan_result = plan_unit(unit, db)
        return plan_result
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )


@router.post("/{unit_id}/generate")
def generate_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """
    Generate learning pack content for all planned slots.
    Supports resuming without overwriting draft/approved content.
    """
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unit {unit_id} not found.",
        )

    try:
        gen_result = generate_unit_pack(unit_id, db)
        return gen_result
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )


@router.get("/{unit_id}/pack")
def get_unit_pack(
    unit_id: int,
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """
    Retrieve the full learning pack grouped by objective and slot type.
    Includes asset statuses, claims verification ratios, and quality flags.
    """
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unit {unit_id} not found.",
        )

    objectives_map = {}
    for obj in unit.objectives:
        objectives_map[obj.id] = {
            "objective_id": obj.id,
            "position": obj.position,
            "text": obj.text,
            "bloom_target": obj.bloom_target,
            "supported": obj.supported,
            "support_note": obj.support_note,
            "slots": [],
        }

    total_claims = 0
    verified_claims = 0

    slots = db.query(Slot).filter(Slot.unit_id == unit_id).order_by(Slot.position).all()
    for s in slots:
        asset_info = None
        if s.asset:
            cur_v = s.asset.current_version
            v_content = cur_v.content if cur_v else None
            v_ver = cur_v.verification if cur_v else {}
            v_claims = []
            if cur_v:
                for cl in cur_v.claims:
                    total_claims += 1
                    if cl.verified:
                        verified_claims += 1
                    v_claims.append({
                        "text": cl.text,
                        "source_quote": cl.source_quote,
                        "verified": cl.verified,
                        "match_score": cl.match_score,
                        "chunk_id": cl.chunk_id,
                    })

            asset_info = {
                "asset_id": s.asset.id,
                "status": s.asset.status,
                "locked": s.asset.locked,
                "version_no": cur_v.version_no if cur_v else None,
                "model": cur_v.model if cur_v else None,
                "content": v_content,
                "verification": v_ver,
                "claims": v_claims,
            }

        slot_data = {
            "slot_id": s.id,
            "type": s.type,
            "position": s.position,
            "difficulty": s.difficulty,
            "bloom_tag": s.bloom_tag,
            "asset": asset_info,
        }

        if s.objective_id in objectives_map:
            objectives_map[s.objective_id]["slots"].append(slot_data)

    quality_flags = [
        {
            "id": qf.id,
            "code": qf.code,
            "severity": qf.severity,
            "message": qf.message,
            "resolved": qf.resolved,
            "asset_version_id": qf.asset_version_id,
        }
        for qf in unit.quality_flags
    ]

    verification_ratio = round(verified_claims / total_claims, 3) if total_claims > 0 else 1.0

    return {
        "unit_id": unit.id,
        "title": unit.title,
        "status": unit.status,
        "target_grade": unit.target_grade,
        "difficulty": unit.difficulty,
        "language": unit.language,
        "total_claims": total_claims,
        "verified_claims": verified_claims,
        "overall_verification_ratio": verification_ratio,
        "quality_flags": quality_flags,
        "objectives": list(objectives_map.values()),
    }
