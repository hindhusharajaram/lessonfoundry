from typing import Dict, Any


def calculate_impact(unit_id: int, change_type: str, db_session: Any) -> Dict[str, Any]:
    """Calculate the downstream impact of changing an objective or source text."""
    return {"affected_slots": [], "invalidated_assets": []}
