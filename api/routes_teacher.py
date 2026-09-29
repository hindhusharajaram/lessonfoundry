from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.deps import require_teacher, AuthContext
from api.auth_utils import generate_join_code, get_or_create_teacher_user
from db.database import get_db
from db.models import (
    User,
    Enrollment,
    Student,
    QuizAttempt,
    AttemptAnswer,
    Unit,
)

router = APIRouter(prefix="/teacher", tags=["teacher"])


@router.get("/join-code")
def get_teacher_join_code(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_teacher),
):
    """
    Returns the current teacher's unique join code.
    Generates a new 8-character uppercase alphanumeric code if none exists yet.
    """
    teacher = get_or_create_teacher_user(db, auth)
    if not teacher.join_code:
        teacher.join_code = generate_join_code(db)
        db.commit()
        db.refresh(teacher)

    return {
        "join_code": teacher.join_code,
        "teacher_id": teacher.id,
        "teacher_name": teacher.name,
    }


@router.get("/students")
def get_teacher_enrolled_students(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_teacher),
):
    """
    Returns all students enrolled with the current logged-in teacher (via Enrollment).
    Computes average quiz score and last attempt timestamp in a single aggregated query.
    """
    teacher = get_or_create_teacher_user(db, auth)

    rows = (
        db.query(
            User.id.label("student_user_id"),
            User.name.label("name"),
            User.email.label("email"),
            Enrollment.joined_at.label("joined_at"),
            Student.id.label("student_id"),
            func.avg(QuizAttempt.score).label("average_score"),
            func.max(QuizAttempt.submitted_at).label("last_attempt_at"),
            func.count(QuizAttempt.id).label("total_attempts"),
        )
        .join(Enrollment, Enrollment.student_user_id == User.id)
        .outerjoin(Student, Student.student_user_id == User.id)
        .outerjoin(
            QuizAttempt,
            (QuizAttempt.student_id == Student.id) & (QuizAttempt.submitted_at.isnot(None)),
        )
        .filter(Enrollment.teacher_user_id == teacher.id)
        .group_by(User.id, User.name, User.email, Enrollment.joined_at, Student.id)
        .order_by(User.name.asc())
        .all()
    )

    students = []
    for r in rows:
        students.append({
            "student_user_id": r.student_user_id,
            "name": r.name,
            "email": r.email,
            "joined_at": r.joined_at.isoformat() if r.joined_at else None,
            "average_score": round(float(r.average_score), 1) if r.average_score is not None else None,
            "last_attempt_at": r.last_attempt_at.isoformat() if r.last_attempt_at else None,
            "total_attempts": int(r.total_attempts or 0),
        })

    return {
        "teacher_id": teacher.id,
        "teacher_name": teacher.name,
        "total_enrolled": len(students),
        "students": students,
    }


@router.get("/students/{student_user_id}/report")
def get_student_report(
    student_user_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_teacher),
):
    """
    Returns full individual report for one enrolled student:
    - Enforces 403 Forbidden check if the student is not enrolled with this teacher.
    - Every QuizAttempt with score, date, and question breakdown.
    - Per-objective accuracy calculated across attempts.
    """
    teacher = get_or_create_teacher_user(db, auth)

    # 1. Enforce real enrollment authorization
    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.teacher_user_id == teacher.id,
            Enrollment.student_user_id == student_user_id,
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Student {student_user_id} is not enrolled in your classroom.",
        )

    # 2. Resolve Student user and linked Student record
    student_user = db.query(User).filter(User.id == student_user_id).first()
    if not student_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student user {student_user_id} not found.",
        )

    student_record = db.query(Student).filter(Student.student_user_id == student_user_id).first()
    student_db_id = student_record.id if student_record else None

    # 3. Retrieve all quiz attempts for this student
    attempts_data = []
    if student_db_id:
        attempts = (
            db.query(QuizAttempt)
            .filter(
                QuizAttempt.student_id == student_db_id,
                QuizAttempt.submitted_at.isnot(None),
            )
            .order_by(QuizAttempt.submitted_at.asc())
            .all()
        )
        for att in attempts:
            total_q = len(att.answers)
            correct_q = sum(1 for a in att.answers if a.correct)
            attempts_data.append({
                "attempt_id": att.id,
                "unit_id": att.unit_id,
                "unit_title": att.unit.title if att.unit else "Unknown Unit",
                "score": att.score,
                "submitted_at": att.submitted_at.isoformat() if att.submitted_at else None,
                "total_questions": total_q,
                "correct_answers": correct_q,
            })

    # 4. Per-objective accuracy calculation (reusing class-wide analytics logic)
    objective_perf = []
    if student_db_id and attempts_data:
        attempted_unit_ids = {a["unit_id"] for a in attempts_data}
        units = db.query(Unit).filter(Unit.id.in_(attempted_unit_ids)).all()

        for u in units:
            for obj in u.objectives:
                obj_asset_ids = [
                    s.asset.id for s in obj.slots
                    if s.asset and s.type in ["quiz_item", "practice_foundation", "practice_advanced"]
                ]
                if not obj_asset_ids:
                    continue

                obj_answers = (
                    db.query(AttemptAnswer)
                    .join(QuizAttempt, AttemptAnswer.attempt_id == QuizAttempt.id)
                    .filter(
                        QuizAttempt.student_id == student_db_id,
                        QuizAttempt.unit_id == u.id,
                        AttemptAnswer.asset_id.in_(obj_asset_ids),
                    )
                    .all()
                )
                total_ans = len(obj_answers)
                if total_ans == 0:
                    continue

                correct_ans = sum(1 for a in obj_answers if a.correct)
                acc = round((correct_ans / total_ans) * 100, 1)

                objective_perf.append({
                    "objective_id": obj.id,
                    "unit_id": u.id,
                    "unit_title": u.title,
                    "text": obj.text,
                    "bloom_target": obj.bloom_target,
                    "accuracy": acc,
                    "total_answered": total_ans,
                    "correct_answers": correct_ans,
                    "is_gap": acc < 70.0,
                })

    avg_score = (
        round(sum(a["score"] for a in attempts_data if a["score"] is not None) / len(attempts_data), 1)
        if attempts_data else None
    )

    return {
        "student": {
            "student_user_id": student_user.id,
            "name": student_user.name,
            "email": student_user.email,
            "joined_at": enrollment.joined_at.isoformat(),
            "average_score": avg_score,
            "total_attempts": len(attempts_data),
        },
        "attempts": attempts_data,
        "objective_performance": objective_perf,
    }
