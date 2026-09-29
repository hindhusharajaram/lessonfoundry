from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.deps import require_student, AuthContext
from db.database import get_db
from db.models import (
    Asset,
    AttemptAnswer,
    Enrollment,
    Publication,
    QuizAttempt,
    Slot,
    Student,
    Unit,
    User,
)

router = APIRouter(prefix="/student", tags=["student"])


class SubmitAnswerItem(BaseModel):
    asset_id: int
    chosen_index: int
    time_seconds: int = 0


class SubmitAttemptRequest(BaseModel):
    unit_id: int
    answers: List[SubmitAnswerItem]


@router.get("/units")
def get_student_units(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_student),
):
    """
    List published units available to students.
    Only published units are returned.
    """
    pubs = db.query(Publication).order_by(Publication.published_at.desc()).all()
    # Group by unit_id to get latest publication
    seen_units = set()
    unit_list = []
    for p in pubs:
        if p.unit_id in seen_units:
            continue
        seen_units.add(p.unit_id)
        unit = p.unit
        if not unit:
            continue
        unit_list.append({
            "unit_id": unit.id,
            "title": unit.title,
            "target_grade": unit.target_grade,
            "difficulty": unit.difficulty,
            "language": unit.language,
            "published_at": p.published_at.isoformat(),
            "class_label": p.class_label,
            "approved_assets_count": p.snapshot.get("approved_assets_count", 0),
        })

    return {"units": unit_list}


@router.get("/units/{unit_id}")
def get_student_unit(
    unit_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_student),
):
    """
    Retrieve published learning pack content for a student.
    Rule 4:
    - ONLY status=approved content is student-visible. Enforced in API.
    - Answer keys (correct_index, rationale, quote) are STRIPPED before submission.
    """
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unit {unit_id} not found.",
        )

    # Check for active publication
    pub = (
        db.query(Publication)
        .filter(Publication.unit_id == unit_id)
        .order_by(Publication.published_at.desc())
        .first()
    )
    if not pub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This unit has not been published for students yet.",
        )

    slots = db.query(Slot).filter(Slot.unit_id == unit_id).order_by(Slot.position).all()
    student_slots = []

    for s in slots:
        # Enforce approved only
        if not s.asset or s.asset.status != "approved" or not s.asset.current_version:
            continue

        raw_content = s.asset.current_version.content or {}
        safe_content = dict(raw_content)

        # Strip answer keys from assessment slots
        if s.type in ["quiz_item", "practice_foundation", "practice_advanced"]:
            safe_content = {
                "question": raw_content.get("question", ""),
                "options": raw_content.get("options", []),
                "bloom": raw_content.get("bloom", s.bloom_tag),
                "difficulty": raw_content.get("difficulty", s.difficulty),
            }

        student_slots.append({
            "slot_id": s.id,
            "asset_id": s.asset.id,
            "type": s.type,
            "position": s.position,
            "objective_id": s.objective_id,
            "content": safe_content,
        })

    return {
        "unit_id": unit.id,
        "title": unit.title,
        "target_grade": unit.target_grade,
        "difficulty": unit.difficulty,
        "language": unit.language,
        "slots": student_slots,
    }


@router.post("/attempts", status_code=status.HTTP_201_CREATED)
def submit_student_attempt(
    req: SubmitAttemptRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_student),
):
    """
    Grade and record student quiz submission.
    """
    student = None
    if auth.user_id:
        student = db.query(Student).filter(Student.student_user_id == auth.user_id).first()
    if not student and auth.student_id:
        student = db.query(Student).filter(Student.id == auth.student_id).first()
    if not student:
        student_id = auth.student_id or 1
        student = Student(name=f"Student #{student_id}", class_label="Demo Class", synthetic=True)
        db.add(student)
        db.flush()

    unit = db.query(Unit).filter(Unit.id == req.unit_id).first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unit {req.unit_id} not found.",
        )

    attempt = QuizAttempt(
        student_id=student.id,
        unit_id=unit.id,
        started_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    db.flush()

    correct_count = 0
    total_answers = len(req.answers)
    answer_rows = []

    for item in req.answers:
        asset = db.query(Asset).filter(Asset.id == item.asset_id).first()
        is_correct = False
        if asset and asset.current_version and asset.current_version.content:
            key_index = asset.current_version.content.get("correct_index")
            is_correct = (item.chosen_index == key_index)

        if is_correct:
            correct_count += 1

        ans_record = AttemptAnswer(
            attempt_id=attempt.id,
            asset_id=item.asset_id,
            chosen_index=item.chosen_index,
            correct=is_correct,
            time_seconds=item.time_seconds,
        )
        db.add(ans_record)
        answer_rows.append(ans_record)

    score_pct = round((correct_count / total_answers) * 100, 1) if total_answers > 0 else 0.0
    attempt.score = score_pct
    db.commit()
    db.refresh(attempt)

    return {
        "attempt_id": attempt.id,
        "student_id": student.id,
        "unit_id": unit.id,
        "score": attempt.score,
        "correct_count": correct_count,
        "total_questions": total_answers,
        "submitted_at": attempt.submitted_at.isoformat(),
        "message": f"Quiz submitted. Final Score: {attempt.score}%",
    }


@router.get("/attempts/{attempt_id}/results")
def get_attempt_results(
    attempt_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_student),
):
    """
    Retrieve graded quiz results with answer keys, explanations, and evidence quotes now accessible post-submission.
    """
    attempt = db.query(QuizAttempt).filter(QuizAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attempt {attempt_id} not found.",
        )

    results = []
    is_teacher_only = attempt.unit and attempt.unit.answer_visibility == "teacher_only"
    for ans in attempt.answers:
        asset = ans.asset
        content = asset.current_version.content if asset and asset.current_version else {}
        options = content.get("options", [])
        chosen_opt = options[ans.chosen_index] if (0 <= ans.chosen_index < len(options)) else "Unknown"
        raw_correct_idx = content.get("correct_index", 0)
        correct_idx = None if is_teacher_only else raw_correct_idx
        correct_opt = None if is_teacher_only else (options[raw_correct_idx] if (0 <= raw_correct_idx < len(options)) else "Unknown")

        results.append({
            "asset_id": ans.asset_id,
            "question": content.get("question", ""),
            "options": options,
            "chosen_index": ans.chosen_index,
            "chosen_option": chosen_opt,
            "correct_index": correct_idx,
            "correct_option": correct_opt,
            "correct": ans.correct,
            "rationale": None if is_teacher_only else content.get("rationale", ""),
            "supporting_quote": None if is_teacher_only else content.get("quote", ""),
            "time_seconds": ans.time_seconds,
        })

    return {
        "attempt_id": attempt.id,
        "unit_id": attempt.unit_id,
        "unit_title": attempt.unit.title if attempt.unit else "",
        "student_id": attempt.student_id,
        "score": attempt.score,
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
        "results": results,
    }


class StudentEnrollRequest(BaseModel):
    join_code: str


@router.post("/enroll")
def enroll_student_by_code(
    req: StudentEnrollRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_student),
):
    """
    Enrolls the current student with a teacher using a valid join code.
    """
    code = req.join_code.strip().upper()
    teacher = db.query(User).filter(User.join_code == code, User.role == "teacher").first()
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid join code '{req.join_code}'. Teacher not found.",
        )

    # Determine student user and student record
    student_user_id = auth.user_id
    if not student_user_id:
        student_rec = db.query(Student).filter(Student.id == (auth.student_id or 1)).first()
        if student_rec and student_rec.student_user_id:
            student_user_id = student_rec.student_user_id
        else:
            user = User(
                email=f"student_{auth.student_id or 1}@lessonfoundry.edu",
                name=student_rec.name if student_rec else f"Student #{auth.student_id or 1}",
                role="student",
            )
            db.add(user)
            db.flush()
            student_user_id = user.id
            if student_rec:
                student_rec.student_user_id = user.id
                db.flush()

    # Create enrollment if not already existing
    existing = db.query(Enrollment).filter(
        Enrollment.teacher_user_id == teacher.id,
        Enrollment.student_user_id == student_user_id,
    ).first()

    if not existing:
        enrollment = Enrollment(
            teacher_user_id=teacher.id,
            student_user_id=student_user_id,
        )
        db.add(enrollment)
        db.commit()

    # Update student record class label
    st = db.query(Student).filter(Student.student_user_id == student_user_id).first()
    if st:
        st.class_label = f"Class {teacher.name}"
        db.commit()

    return {
        "message": f"Successfully enrolled with teacher {teacher.name}.",
        "teacher_id": teacher.id,
        "teacher_name": teacher.name,
        "student_user_id": student_user_id,
    }

