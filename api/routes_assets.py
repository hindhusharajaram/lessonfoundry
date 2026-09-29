import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.deps import require_teacher
from db.database import get_db
from db.models import (
    Asset,
    AssetVersion,
    Claim,
    DecisionLog,
    Feedback,
    QualityFlag,
    Slot,
    Unit,
)
from engine.generator import generate_slot
from engine.guardrails import run_unit_guardrails
from engine.model import build_source_block, generate_json
from engine.solver import verify_asset_with_solver
from engine.verifier import verify_quote

router = APIRouter(prefix="/assets", tags=["assets"])


# ==========================================
# Request Schemas
# ==========================================

class AssetStatusUpdateRequest(BaseModel):
    status: str = Field(description="draft | approved | needs_revision")
    actor: str = "teacher"
    note: Optional[str] = None
    override: bool = False
    override_reason: Optional[str] = None


class AssetRegenerateRequest(BaseModel):
    feedback: Optional[str] = None


# ==========================================
# Helpers
# ==========================================

def _compute_content_diff(old_content: Dict[str, Any], new_content: Dict[str, Any]) -> Dict[str, Any]:
    """Simple field-level diff comparing two content dictionary shapes."""
    diff: Dict[str, Any] = {"changed_fields": [], "details": {}}
    all_keys = set(old_content.keys()).union(set(new_content.keys()))
    for k in all_keys:
        val_old = old_content.get(k)
        val_new = new_content.get(k)
        if val_old != val_new:
            diff["changed_fields"].append(k)
            diff["details"][k] = {"before": val_old, "after": val_new}
    return diff


# ==========================================
# Endpoints
# ==========================================

@router.post("/{asset_id}/status")
def update_asset_status(
    asset_id: int,
    req: AssetStatusUpdateRequest,
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """
    Update asset status (draft, approved, needs_revision).
    Spec Rule 2 & 4:
    - Approving is refused (HTTP 409) if the current version has unverified claims
      or error-level quality flags, unless explicit override=True with reason is provided.
    - Approving locks the asset (locked=True).
    - Decisions and overrides are logged in DecisionLog.
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found.",
        )

    target_status = req.status.lower()
    if target_status not in ["draft", "approved", "needs_revision"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{req.status}'. Must be 'draft', 'approved', or 'needs_revision'.",
        )

    cur_version = asset.current_version
    if not cur_version and target_status == "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve an empty asset without generated content version.",
        )

    # If attempting to approve, enforce quality gate
    if target_status == "approved" and cur_version:
        unverified_claims = [c for c in cur_version.claims if not c.verified]
        error_flags = (
            db.query(QualityFlag)
            .filter(
                QualityFlag.asset_version_id == cur_version.id,
                QualityFlag.severity == "error",
                QualityFlag.resolved == False,
            )
            .all()
        )

        blocking_reasons = []
        if unverified_claims:
            blocking_reasons.append(
                f"{len(unverified_claims)} unverified quote claim(s) exist in this asset."
            )
        for ef in error_flags:
            blocking_reasons.append(f"[{ef.code}] {ef.message}")

        if blocking_reasons and not req.override:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "Approval refused: content has unresolved error flags or unverified claims.",
                    "blocking_reasons": blocking_reasons,
                    "action_required": "Resolve quality flags or re-submit with override=true and override_reason.",
                },
            )

        if req.override:
            if not req.override_reason or not req.override_reason.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="override_reason is mandatory when approving with override=true.",
                )
            # Log override decision
            d_log = DecisionLog(
                unit_id=asset.slot.unit_id,
                asset_id=asset.id,
                action="approve_override",
                actor=req.actor,
                detail={"reason": req.override_reason, "note": req.note, "version_id": cur_version.id},
            )
            db.add(d_log)
        else:
            d_log = DecisionLog(
                unit_id=asset.slot.unit_id,
                asset_id=asset.id,
                action="approve",
                actor=req.actor,
                detail={"note": req.note, "version_id": cur_version.id},
            )
            db.add(d_log)

        asset.status = "approved"
        asset.locked = True

    elif target_status in ["draft", "needs_revision"]:
        asset.status = target_status
        asset.locked = False
        d_log = DecisionLog(
            unit_id=asset.slot.unit_id,
            asset_id=asset.id,
            action=f"set_status_{target_status}",
            actor=req.actor,
            detail={"note": req.note},
        )
        db.add(d_log)

    db.commit()
    db.refresh(asset)

    return {
        "asset_id": asset.id,
        "status": asset.status,
        "locked": asset.locked,
        "current_version_id": asset.current_version_id,
        "message": f"Asset status updated to '{asset.status}'",
    }


@router.post("/{asset_id}/regenerate")
def regenerate_asset(
    asset_id: int,
    req: AssetRegenerateRequest = Body(default=AssetRegenerateRequest()),
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """
    Regenerate content for an individual asset.
    Spec Rule 5:
    - Regeneration never touches approved or locked assets unless teacher reverts status.
    - Creates a new AssetVersion (parent_version_id set); nothing is overwritten.
    - Runs verifier, solver, and guardrails for the asset.
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found.",
        )

    if asset.locked or asset.status == "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot regenerate an approved or locked asset. Please set status to 'needs_revision' first.",
        )

    slot = asset.slot
    parent_version = asset.current_version

    if req.feedback:
        fb = Feedback(asset_id=asset.id, note=req.feedback)
        db.add(fb)
        db.commit()

    try:
        new_version = generate_slot(
            slot=slot,
            db=db,
            feedback=req.feedback,
            parent_version=parent_version,
        )

        # Run independent solver on new version if quiz/practice
        if slot.type in ["quiz_item", "practice_foundation", "practice_advanced"]:
            verify_asset_with_solver(slot, new_version, db)

        # Run guardrails on unit
        run_unit_guardrails(slot.unit_id, db)

        db.refresh(asset)
        return {
            "asset_id": asset.id,
            "status": asset.status,
            "version_no": new_version.version_no,
            "parent_version_id": new_version.parent_version_id,
            "content": new_version.content,
            "verification": new_version.verification,
            "message": f"Successfully regenerated asset version {new_version.version_no}",
        }
    except Exception as e:
        asset.status = "generation_failed"
        flag = QualityFlag(
            unit_id=slot.unit_id,
            asset_version_id=parent_version.id if parent_version else None,
            code="regeneration_failed",
            severity="error",
            message=f"Regeneration failed: {str(e)}",
        )
        db.add(flag)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Regeneration failed: {str(e)}",
        )


@router.get("/{asset_id}/versions")
def get_asset_versions(
    asset_id: int,
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """
    Retrieve full version history and provenance diffs for an asset.
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} not found.",
        )

    versions = (
        db.query(AssetVersion)
        .filter(AssetVersion.asset_id == asset_id)
        .order_by(AssetVersion.version_no.asc())
        .all()
    )

    version_list = []
    versions_map = {v.id: v for v in versions}

    for v in versions:
        parent_v = versions_map.get(v.parent_version_id) if v.parent_version_id else None
        diff = _compute_content_diff(parent_v.content, v.content) if parent_v else {"initial_version": True}

        claims_data = [
            {
                "id": c.id,
                "text": c.text,
                "source_quote": c.source_quote,
                "verified": c.verified,
                "match_score": c.match_score,
                "chunk_id": c.chunk_id,
            }
            for c in v.claims
        ]

        version_list.append({
            "id": v.id,
            "version_no": v.version_no,
            "parent_version_id": v.parent_version_id,
            "variant": v.variant,
            "model": v.model,
            "prompt_version": v.prompt_version,
            "settings": v.settings,
            "source_version_id": v.source_version_id,
            "source_sha256": v.source_sha256,
            "content": v.content,
            "verification": v.verification,
            "claims": claims_data,
            "diff_from_parent": diff,
            "created_at": v.created_at.isoformat() if v.created_at else None,
            "is_current": (asset.current_version_id == v.id),
        })

    return {
        "asset_id": asset.id,
        "slot_id": asset.slot_id,
        "current_status": asset.status,
        "current_version_id": asset.current_version_id,
        "total_versions": len(versions),
        "versions": version_list,
    }


@router.post("/{asset_id}/simplify")
def simplify_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """
    Create a simplified reading-level variant (variant='simplified') of the current asset version.
    Semantic consistency rules:
    - Preserves all core glossary terms.
    - Every sentence retains verified source quotes.
    - Quiz answers remain unchanged.
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset or not asset.current_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset {asset_id} or its current version not found.",
        )

    cur_v = asset.current_version
    slot = asset.slot
    unit = slot.unit
    source_chunks = unit.pinned_source_version.chunks if unit.pinned_source_version else []

    source_block = build_source_block(source_chunks)
    prompt = (
        f"{source_block}\n\n"
        f"Original Content JSON:\n{json.dumps(cur_v.content)}\n\n"
        f"Task: Adapt the content to a simpler, highly accessible reading level for students needing scaffolding.\n"
        f"Strict Rules:\n"
        f"1. Preserve all key scientific terms and their definitions.\n"
        f"2. Every sentence/step must continue to carry an exact verbatim quote from the source above.\n"
        f"3. For quiz/practice items: the question, options, and correct_index must remain semantically identical, only simplified in phrasing.\n"
        f"4. Output must match the exact JSON schema of the original content."
    )

    try:
        # Schema matches slot type
        from engine.generator import (
            ExplanationContent,
            ExampleContent,
            QuizItemContent,
            RevisionContent,
        )
        schema_map = {
            "explanation": ExplanationContent,
            "example": ExampleContent,
            "quiz_item": QuizItemContent,
            "practice_foundation": QuizItemContent,
            "practice_advanced": QuizItemContent,
            "revision": RevisionContent,
        }
        target_schema = schema_map.get(slot.type, ExplanationContent)

        simplified_obj, meta = generate_json(
            prompt=prompt,
            schema=target_schema,
            temperature=0.2,
            prompt_version="simplify-1.0",
        )
        simplified_dict = simplified_obj.model_dump()

        new_version_no = cur_v.version_no + 1
        new_v = AssetVersion(
            asset_id=asset.id,
            version_no=new_version_no,
            parent_version_id=cur_v.id,
            variant="simplified",
            content=simplified_dict,
            model=meta.get("model", "gemini-2.5-flash"),
            prompt_version="simplify-1.0",
            settings={"variant": "simplified", "base_version_id": cur_v.id},
            source_version_id=cur_v.source_version_id,
            source_sha256=cur_v.source_sha256,
            verification={},
        )
        db.add(new_v)
        db.flush()

        # Verify claims
        from engine.generator import _extract_claims_from_content
        raw_claims = _extract_claims_from_content(simplified_dict, slot.type)
        verified_claims_count = 0
        ver_details = []

        for c_text, quote in raw_claims:
            ver_res = verify_quote(quote, source_chunks)
            if ver_res.verified:
                verified_claims_count += 1
            claim_row = Claim(
                asset_version_id=new_v.id,
                text=c_text,
                source_quote=quote,
                chunk_id=ver_res.chunk_id,
                char_start=ver_res.char_start,
                char_end=ver_res.char_end,
                verified=ver_res.verified,
                match_score=ver_res.match_score,
            )
            db.add(claim_row)
            ver_details.append({"quote": quote, "verified": ver_res.verified, "score": ver_res.match_score})

        total_claims = len(raw_claims)
        new_v.verification = {
            "total_claims": total_claims,
            "verified_claims": verified_claims_count,
            "verification_ratio": round(verified_claims_count / total_claims, 3) if total_claims > 0 else 1.0,
            "all_verified": (verified_claims_count == total_claims),
            "details": ver_details,
        }

        asset.current_version_id = new_v.id
        db.commit()

        return {
            "asset_id": asset.id,
            "version_no": new_v.version_no,
            "variant": new_v.variant,
            "content": new_v.content,
            "verification": new_v.verification,
            "message": "Simplified variant created successfully.",
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simplification generation failed: {str(e)}",
        )


class BloomTagUpdateRequest(BaseModel):
    bloom_tag: str
    actor: str = "teacher"
    reason: Optional[str] = None


@router.put("/{asset_id}/bloom-tag")
def update_bloom_tag(
    asset_id: int,
    req: BloomTagUpdateRequest,
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """Teacher overrides Bloom taxonomy tag with mandatory audit logging in DecisionLog."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset or not asset.slot:
        raise HTTPException(status_code=404, detail="Asset not found")

    old_tag = asset.slot.bloom_tag
    asset.slot.bloom_tag = req.bloom_tag

    # Log in DecisionLog
    log_entry = DecisionLog(
        unit_id=asset.slot.unit_id,
        asset_id=asset.id,
        action="override_bloom_tag",
        actor=req.actor,
        detail={
            "old_tag": old_tag,
            "new_tag": req.bloom_tag,
            "reason": req.reason or "Teacher pedagogical adjustment",
        },
    )
    db.add(log_entry)
    db.commit()

    return {
        "asset_id": asset.id,
        "slot_id": asset.slot.id,
        "bloom_tag": asset.slot.bloom_tag,
        "message": f"Bloom tag updated from {old_tag} to {req.bloom_tag}",
    }


class FlagResolveRequest(BaseModel):
    action: str = "resolve"  # resolve | override
    reason: Optional[str] = None
    actor: str = "teacher"


@router.post("/flags/{flag_id}/resolve")
def resolve_flag(
    flag_id: int,
    req: FlagResolveRequest,
    db: Session = Depends(get_db),
    auth=Depends(require_teacher),
):
    """Resolve or override a quality flag with audit tracking."""
    flag = db.query(QualityFlag).filter(QualityFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Quality flag not found")

    if req.action == "override" and not req.reason:
        raise HTTPException(
            status_code=400,
            detail="Mandatory reason required when overriding a quality flag.",
        )

    flag.resolved = True
    flag.resolved_by = req.actor

    log_entry = DecisionLog(
        unit_id=flag.unit_id,
        asset_id=flag.asset_version.asset_id if flag.asset_version else None,
        action=f"flag_{req.action}",
        actor=req.actor,
        detail={
            "flag_id": flag.id,
            "code": flag.code,
            "severity": flag.severity,
            "message": flag.message,
            "reason": req.reason,
        },
    )
    db.add(log_entry)
    db.commit()

    return {
        "flag_id": flag.id,
        "resolved": True,
        "resolved_by": flag.resolved_by,
        "message": f"Flag {flag.code} successfully {req.action}d.",
    }

