from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from api.deps import require_student
from db.database import get_db

router = APIRouter(prefix="/student", tags=["student"])


@router.get("/units")
def get_student_units(
    db: Session = Depends(get_db),
    auth=Depends(require_student),
):
    return {"units": []}


@router.get("/units/{unit_id}")
def get_student_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    auth=Depends(require_student),
):
    # Rule 4: Only status=approved content is student-visible. Enforced in API.
    # Answer keys are never returned to student endpoints before submission.
    return {"unit_id": unit_id, "approved_assets": []}


@router.post("/attempts")
def submit_student_attempt(
    db: Session = Depends(get_db),
    auth=Depends(require_student),
):
    return {"message": "Attempt submitted"}


@router.get("/attempts/{attempt_id}/results")
def get_attempt_results(
    attempt_id: int,
    db: Session = Depends(get_db),
    auth=Depends(require_student),
):
    return {"attempt_id": attempt_id, "score": 0.0, "details": []}
