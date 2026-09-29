from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from db.models import Asset, AssetVersion, Objective, Slot, Unit
from engine.generator import generate_slot
from engine.guardrails import run_unit_guardrails
from engine.solver import verify_asset_with_solver


def _get_slot_name(slot: Slot) -> str:
    type_display = slot.type.replace("_", " ").title()
    content = (
        slot.asset.current_version.content
        if (slot.asset and slot.asset.current_version and isinstance(slot.asset.current_version.content, dict))
        else {}
    )
    title = content.get("title") or content.get("question") or content.get("summary")
    if title:
        short_title = title[:50] + ("..." if len(title) > 50 else "")
        return f"{type_display} (#{slot.position}): {short_title}"
    return f"{type_display} (Slot #{slot.position})"


def analyze_change_impact(unit_id: int, change_descriptor: str, db: Session) -> Dict[str, Any]:
    """
    Analyzes the downstream impact of proposed changes to a Unit:
    - difficulty:old->new (e.g. difficulty:medium->advanced)
    - target_grade:old->new
    - objective:{id}:edit
    - source_version:{old_v}->{new_v}
    
    Returns affected and unaffected items with specific reasons.
    """
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise ValueError(f"Unit {unit_id} not found.")

    slots = db.query(Slot).filter(Slot.unit_id == unit_id).order_by(Slot.position).all()
    affected_slots = []
    unaffected_slots = []

    change_lower = change_descriptor.lower().strip()

    # Case 1: Difficulty change
    if change_lower.startswith("difficulty:"):
        parts = change_lower.split(":", 1)[1]
        for s in slots:
            is_approved = bool(s.asset and s.asset.status == "approved")
            if s.type in ["quiz_item", "practice_foundation", "practice_advanced"]:
                affected_slots.append({
                    "slot_id": s.id,
                    "name": _get_slot_name(s),
                    "type": s.type,
                    "position": s.position,
                    "objective_id": s.objective_id,
                    "is_approved": is_approved,
                    "current_status": s.asset.status if s.asset else "draft",
                    "reason": f"Assessment item difficulty and Bloom taxonomy targets depend directly on unit difficulty change ({parts}).",
                })
            else:
                unaffected_slots.append({
                    "slot_id": s.id,
                    "name": _get_slot_name(s),
                    "type": s.type,
                    "position": s.position,
                    "objective_id": s.objective_id,
                    "is_approved": is_approved,
                    "current_status": s.asset.status if s.asset else "draft",
                    "reason": "Core conceptual explanation and glossary definitions remain valid across difficulty shifts.",
                })

    # Case 2: Target Grade change
    elif change_lower.startswith("target_grade:") or change_lower.startswith("grade:"):
        parts = change_lower.split(":", 1)[1]
        for s in slots:
            is_approved = bool(s.asset and s.asset.status == "approved")
            affected_slots.append({
                "slot_id": s.id,
                "name": _get_slot_name(s),
                "type": s.type,
                "position": s.position,
                "objective_id": s.objective_id,
                "is_approved": is_approved,
                "current_status": s.asset.status if s.asset else "draft",
                "reason": f"Reading level and sentence complexity must adjust for target grade change ({parts}).",
            })

    # Case 3: Objective Edit
    elif "objective:" in change_lower:
        # e.g. objective:1:edit or objective:2
        target_obj_id = None
        for part in change_lower.split(":"):
            if part.isdigit():
                target_obj_id = int(part)
                break

        for s in slots:
            is_approved = bool(s.asset and s.asset.status == "approved")
            if target_obj_id is not None and s.objective_id == target_obj_id:
                affected_slots.append({
                    "slot_id": s.id,
                    "name": _get_slot_name(s),
                    "type": s.type,
                    "position": s.position,
                    "objective_id": s.objective_id,
                    "is_approved": is_approved,
                    "current_status": s.asset.status if s.asset else "draft",
                    "reason": f"Slot is directly aligned to modified Objective #{target_obj_id}.",
                })
            else:
                unaffected_slots.append({
                    "slot_id": s.id,
                    "name": _get_slot_name(s),
                    "type": s.type,
                    "position": s.position,
                    "objective_id": s.objective_id,
                    "is_approved": is_approved,
                    "current_status": s.asset.status if s.asset else "draft",
                    "reason": f"Slot is aligned to Objective #{s.objective_id} which was not modified.",
                })

    # Case 4: Source Version change
    elif "source_version:" in change_lower:
        parts = change_lower.split(":", 1)[1]
        for s in slots:
            is_approved = bool(s.asset and s.asset.status == "approved")
            affected_slots.append({
                "slot_id": s.id,
                "name": _get_slot_name(s),
                "type": s.type,
                "position": s.position,
                "objective_id": s.objective_id,
                "is_approved": is_approved,
                "current_status": s.asset.status if s.asset else "draft",
                "reason": f"Source document text was updated ({parts}); quotes require re-anchoring to new chunk offsets.",
            })

    # Default general change
    else:
        for s in slots:
            is_approved = bool(s.asset and s.asset.status == "approved")
            affected_slots.append({
                "slot_id": s.id,
                "name": _get_slot_name(s),
                "type": s.type,
                "position": s.position,
                "objective_id": s.objective_id,
                "is_approved": is_approved,
                "current_status": s.asset.status if s.asset else "draft",
                "reason": f"Potentially affected by change: '{change_descriptor}'.",
            })

    return {
        "unit_id": unit.id,
        "change_descriptor": change_descriptor,
        "total_slots": len(slots),
        "affected_count": len(affected_slots),
        "unaffected_count": len(unaffected_slots),
        "approved_stale_count": sum(1 for a in affected_slots if a["is_approved"]),
        "affected_slots": affected_slots,
        "unaffected_slots": unaffected_slots,
    }


def regenerate_affected_assets(unit_id: int, change_descriptor: str, db: Session) -> Dict[str, Any]:
    """
    Regenerates ONLY affected, NON-APPROVED assets.
    Reports approved-but-stale assets for teacher decision (never auto-overwrites approved assets).
    """
    impact = analyze_change_impact(unit_id, change_descriptor, db)
    affected_slots_data = impact["affected_slots"]

    regenerated_slots = []
    approved_stale_slots = []

    for item in affected_slots_data:
        slot_id = item["slot_id"]
        slot = db.query(Slot).filter(Slot.id == slot_id).first()
        if not slot:
            continue

        asset = slot.asset
        if asset and (asset.status == "approved" or asset.locked):
            approved_stale_slots.append({
                "slot_id": slot.id,
                "asset_id": asset.id,
                "type": slot.type,
                "current_version_no": asset.current_version.version_no if asset.current_version else 1,
                "status": "approved_stale",
                "message": "Approved asset was not modified automatically. Teacher decision required to unlock and regenerate.",
            })
            continue

        # Regenerate unapproved slot
        try:
            parent_v = asset.current_version if asset else None
            new_v = generate_slot(
                slot=slot,
                db=db,
                feedback=f"Regenerated due to change: {change_descriptor}",
                parent_version=parent_v,
            )
            if slot.type in ["quiz_item", "practice_foundation", "practice_advanced"]:
                verify_asset_with_solver(slot, new_v, db)

            regenerated_slots.append({
                "slot_id": slot.id,
                "asset_id": asset.id if asset else None,
                "type": slot.type,
                "new_version_no": new_v.version_no,
                "status": "draft",
            })
        except Exception as e:
            if asset:
                asset.status = "generation_failed"
                db.commit()

    run_unit_guardrails(unit_id, db)

    return {
        "unit_id": unit_id,
        "change_descriptor": change_descriptor,
        "regenerated_count": len(regenerated_slots),
        "approved_stale_count": len(approved_stale_slots),
        "regenerated_slots": regenerated_slots,
        "approved_stale_slots": approved_stale_slots,
        "message": "Affected non-approved assets regenerated. Approved assets were preserved intact.",
    }
