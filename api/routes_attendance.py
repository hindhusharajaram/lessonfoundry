from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.deps import AuthContext, require_teacher, require_student, get_current_user
from api.auth_utils import get_or_create_teacher_user
from db.database import get_db
from db.models import (
    Attendance,
    ClassSession,
    Enrollment,
    Student,
    Unit,
    User,
    utc_now,
)

router = APIRouter(tags=["attendance"])


class MarkAttendanceRequest(BaseModel):
    student_id: int
    status: str = Field(default="present", description="'present' or 'absent'")
    notes: Optional[str] = None


class BulkAttendanceItem(BaseModel):
    student_id: int
    status: str = Field(default="present", description="'present' or 'absent'")
    notes: Optional[str] = None


class BulkAttendanceRequest(BaseModel):
    records: List[BulkAttendanceItem]


class CreateSessionRequest(BaseModel):
    title: str
    unit_id: Optional[int] = None
    class_label: Optional[str] = "Class 10-A"


def _get_session_students(session: ClassSession, teacher: User, db: Session) -> List[Student]:
    """
    Resolve the real student roster for a session:
    1. If the teacher has enrolled students (via Enrollment), filter by session.class_label if specific, else all enrolled.
    2. If no enrollments exist for this teacher, filter real students matching session.class_label.
    3. If still empty, return all non-synthetic students, or empty list.
    """
    # 1. Enrolled students for this teacher
    enrolled_query = (
        db.query(Student)
        .join(Enrollment, Enrollment.student_user_id == Student.student_user_id)
        .filter(Enrollment.teacher_user_id == teacher.id)
    )
    if session.class_label and session.class_label.lower() not in ["all", ""]:
        class_enrolled = enrolled_query.filter(Student.class_label == session.class_label).all()
        if class_enrolled:
            return class_enrolled

    enrolled = enrolled_query.all()
    if enrolled:
        return enrolled

    # 2. Match non-synthetic students by class_label
    if session.class_label and session.class_label.lower() not in ["all", ""]:
        students_by_class = (
            db.query(Student)
            .filter(Student.class_label == session.class_label, Student.synthetic == False)
            .order_by(Student.id.asc())
            .all()
        )
        if students_by_class:
            return students_by_class

    # 3. All non-synthetic students in system
    real_students = (
        db.query(Student)
        .filter(Student.synthetic == False)
        .order_by(Student.id.asc())
        .all()
    )
    if real_students:
        return real_students

    return []


def _build_attendance_report(session: ClassSession, teacher: User, db: Session) -> Dict[str, Any]:
    """Helper to compute attendance summary and student lists from actual database records."""
    students = _get_session_students(session, teacher, db)

    # Fetch all existing attendance records for this session or linked unit
    att_query = db.query(Attendance)
    if session.unit_id:
        att_query = att_query.filter(
            (Attendance.session_id == session.id) | (Attendance.unit_id == session.unit_id)
        )
    else:
        att_query = att_query.filter(Attendance.session_id == session.id)

    attendance_records = att_query.all()
    attendance_by_student = {a.student_id: a for a in attendance_records}

    present_students = []
    absent_students = []

    for st in students:
        record = attendance_by_student.get(st.id)
        is_present = record is not None and record.status.lower() == "present"

        student_data = {
            "student_id": st.id,
            "student_user_id": st.student_user_id,
            "name": st.name,
            "email": st.resolved_email,
            "class_label": st.class_label,
            "status": "present" if is_present else "absent",
            "activity_type": record.activity_type if (record and is_present) else None,
            "score": record.score if (record and is_present) else None,
            "attended_at": record.attended_at.isoformat() if (record and record.attended_at and is_present) else None,
            "notes": record.notes if record else None,
        }

        if is_present:
            present_students.append(student_data)
        else:
            absent_students.append(student_data)

    present_count = len(present_students)
    absent_count = len(absent_students)
    total_students = present_count + absent_count
    attendance_percentage = (
        round((present_count / total_students) * 100, 1) if total_students > 0 else 0.0
    )

    empty_message = None
    if total_students == 0:
        empty_message = "No students currently enrolled in this class."
    elif present_count == 0:
        empty_message = "No students have accessed this assessment yet."

    return {
        "session_id": session.id,
        "session_title": session.title,
        "class_label": session.class_label,
        "unit_id": session.unit_id,
        "unit_title": session.unit.title if session.unit else None,
        "teacher_id": session.teacher_user_id,
        "total_students": total_students,
        "present_count": present_count,
        "absent_count": absent_count,
        "attendance_percentage": attendance_percentage,
        "present_students": present_students,
        "absent_students": absent_students,
        "present_student_names": [s["name"] for s in present_students],
        "absent_student_names": [s["name"] for s in absent_students],
        "present_student_details": present_students,
        "absent_student_details": absent_students,
        "records": present_students + absent_students,
        "empty_state": (total_students == 0 or present_count == 0),
        "empty_message": empty_message,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


def _ensure_default_session(teacher: User, db: Session) -> ClassSession:
    """Ensure at least one active class session exists for the teacher without any fabricated attendance."""
    session = (
        db.query(ClassSession)
        .filter(ClassSession.teacher_user_id == teacher.id)
        .order_by(ClassSession.id.desc())
        .first()
    )
    if session:
        return session

    # Find latest unit if available
    latest_unit = db.query(Unit).order_by(Unit.id.desc()).first()
    title = f"{latest_unit.title} - Assessment" if latest_unit else "Class 10-A Session"

    session = ClassSession(
        teacher_user_id=teacher.id,
        unit_id=latest_unit.id if latest_unit else None,
        title=title,
        class_label="Class 10-A",
        is_active=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# =========================================================================
# TEACHER ATTENDANCE ENDPOINTS
# =========================================================================

@router.get("/teacher/sessions/{session_id}/attendance")
@router.get("/sessions/{session_id}/attendance")
def get_session_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_teacher),
):
    """
    Teacher-protected endpoint returning full attendance report for a session:
    - total students
    - present count
    - absent count
    - attendance percentage
    - present student list
    - absent student list
    Enforces authorization: teachers can only access their own sessions.
    """
    teacher = get_or_create_teacher_user(db, auth)
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found.",
        )

    # Authorization verification
    if session.teacher_user_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: You do not have permission to access attendance for this session.",
        )

    return _build_attendance_report(session, teacher, db)


@router.get("/teacher/sessions")
def list_teacher_sessions(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_teacher),
):
    """
    List all class sessions for the current teacher with aggregated attendance metrics.
    Automatically ensures a default session exists if none was created yet.
    """
    teacher = get_or_create_teacher_user(db, auth)
    _ensure_default_session(teacher, db)

    sessions = (
        db.query(ClassSession)
        .filter(ClassSession.teacher_user_id == teacher.id)
        .order_by(ClassSession.created_at.desc())
        .all()
    )

    summaries = []
    for s in sessions:
        report = _build_attendance_report(s, teacher, db)
        summaries.append({
            "id": s.id,
            "title": s.title,
            "class_label": s.class_label,
            "unit_id": s.unit_id,
            "unit_title": s.unit.title if s.unit else None,
            "is_active": s.is_active,
            "total_students": report["total_students"],
            "present_count": report["present_count"],
            "absent_count": report["absent_count"],
            "attendance_percentage": report["attendance_percentage"],
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return {"sessions": summaries}


@router.post("/teacher/sessions", status_code=status.HTTP_201_CREATED)
def create_class_session(
    req: CreateSessionRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_teacher),
):
    """Create a new class session for student attendance tracking."""
    teacher = get_or_create_teacher_user(db, auth)

    session = ClassSession(
        teacher_user_id=teacher.id,
        unit_id=req.unit_id,
        title=req.title.strip(),
        class_label=req.class_label.strip() if req.class_label else "Class 10-A",
        is_active=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    report = _build_attendance_report(session, teacher, db)
    return {
        "id": session.id,
        "title": session.title,
        "class_label": session.class_label,
        "unit_id": session.unit_id,
        "is_active": session.is_active,
        "created_at": session.created_at.isoformat(),
        "report": report,
    }


@router.post("/sessions/{session_id}/attendance")
def mark_student_attendance(
    session_id: int,
    req: MarkAttendanceRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_teacher),
):
    """
    Teacher-protected endpoint to mark or update attendance for a single student.
    Guarantees no duplicate records are created for the same student and session.
    """
    teacher = get_or_create_teacher_user(db, auth)
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found.",
        )

    if session.teacher_user_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: You do not have permission to mark attendance for this session.",
        )

    student = db.query(Student).filter(Student.id == req.student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student {req.student_id} not found.",
        )

    clean_status = req.status.strip().lower()
    if clean_status not in ["present", "absent"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'present' or 'absent'.",
        )

    # Upsert attendance record
    att = (
        db.query(Attendance)
        .filter(Attendance.session_id == session_id, Attendance.student_id == req.student_id)
        .first()
    )
    if att:
        att.status = clean_status
        if clean_status == "present" and not att.attended_at:
            att.attended_at = utc_now()
        elif clean_status == "absent":
            att.attended_at = None
        if req.notes is not None:
            att.notes = req.notes
    else:
        att = Attendance(
            session_id=session_id,
            student_id=req.student_id,
            status=clean_status,
            attended_at=utc_now() if clean_status == "present" else None,
            notes=req.notes,
        )
        db.add(att)

    db.commit()
    db.refresh(att)

    # Return refreshed summary stats
    report = _build_attendance_report(session, teacher, db)
    return {
        "message": f"Student '{student.name}' marked as {clean_status}.",
        "attendance": {
            "id": att.id,
            "session_id": att.session_id,
            "student_id": att.student_id,
            "status": att.status,
            "attended_at": att.attended_at.isoformat() if att.attended_at else None,
        },
        "summary": {
            "total_students": report["total_students"],
            "present_count": report["present_count"],
            "absent_count": report["absent_count"],
            "attendance_percentage": report["attendance_percentage"],
        },
    }


@router.post("/sessions/{session_id}/attendance/bulk")
def mark_attendance_bulk(
    session_id: int,
    req: BulkAttendanceRequest,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_teacher),
):
    """
    Teacher-protected endpoint for bulk attendance updates.
    Guarantees idempotency and avoids duplicate records.
    """
    teacher = get_or_create_teacher_user(db, auth)
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found.",
        )

    if session.teacher_user_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: You do not have permission to update attendance for this session.",
        )

    updated_count = 0
    for item in req.records:
        clean_status = item.status.strip().lower()
        if clean_status not in ["present", "absent"]:
            continue

        att = (
            db.query(Attendance)
            .filter(Attendance.session_id == session_id, Attendance.student_id == item.student_id)
            .first()
        )
        if att:
            att.status = clean_status
            if clean_status == "present" and not att.attended_at:
                att.attended_at = utc_now()
            elif clean_status == "absent":
                att.attended_at = None
            if item.notes is not None:
                att.notes = item.notes
        else:
            att = Attendance(
                session_id=session_id,
                student_id=item.student_id,
                status=clean_status,
                attended_at=utc_now() if clean_status == "present" else None,
                notes=item.notes,
            )
            db.add(att)
        updated_count += 1

    db.commit()

    report = _build_attendance_report(session, teacher, db)
    return {
        "message": f"Successfully updated {updated_count} attendance records.",
        "updated_count": updated_count,
        "summary": {
            "total_students": report["total_students"],
            "present_count": report["present_count"],
            "absent_count": report["absent_count"],
            "attendance_percentage": report["attendance_percentage"],
        },
    }


# =========================================================================
# STUDENT-SIDE ATTENDANCE RECORDING
# =========================================================================

@router.post("/student/sessions/{session_id}/join")
def student_join_session(
    session_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_student),
):
    """
    Student-side action: when a student enters/joins a session, records attendance as present.
    Enforces that students can ONLY mark their OWN attendance based on authenticated AuthContext,
    preventing any student from manipulating another student's record.
    """
    session = db.query(ClassSession).filter(ClassSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found.",
        )

    # Resolve student profile from current authenticated student session
    student = None
    if auth.user_id:
        student = db.query(Student).filter(Student.student_user_id == auth.user_id).first()
    if not student and auth.student_id:
        student = db.query(Student).filter(Student.id == auth.student_id).first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found for authenticated user.",
        )

    # Upsert attendance record for this student only
    att = (
        db.query(Attendance)
        .filter(Attendance.session_id == session_id, Attendance.student_id == student.id)
        .first()
    )
    if att:
        if att.status != "present":
            att.status = "present"
            att.attended_at = utc_now()
    else:
        att = Attendance(
            session_id=session_id,
            student_id=student.id,
            status="present",
            attended_at=utc_now(),
        )
        db.add(att)

    db.commit()
    db.refresh(att)

    return {
        "status": "present",
        "session_id": session.id,
        "student_id": student.id,
        "attended_at": att.attended_at.isoformat() if att.attended_at else None,
        "message": f"Attendance recorded for {student.name}.",
    }


@router.get("/teacher/units/{unit_id}/attendance")
def get_unit_attendance(
    unit_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_teacher),
):
    """
    Teacher-protected endpoint returning full attendance report for a specific Unit / Test / Assessment.
    Calculates actual attended students from database records.
    """
    teacher = get_or_create_teacher_user(db, auth)
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unit {unit_id} not found.",
        )

    # Find or create a session tied to this unit
    session = (
        db.query(ClassSession)
        .filter(ClassSession.unit_id == unit_id, ClassSession.teacher_user_id == teacher.id)
        .order_by(ClassSession.id.desc())
        .first()
    )
    if not session:
        session = ClassSession(
            teacher_user_id=teacher.id,
            unit_id=unit.id,
            title=f"{unit.title} - Assessment",
            class_label="All",
            is_active=True,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    return _build_attendance_report(session, teacher, db)


class StudentActivityRequest(BaseModel):
    unit_id: int
    asset_id: Optional[int] = None
    activity_type: Optional[str] = "opened_lesson"


@router.post("/student/units/{unit_id}/activity")
def record_student_unit_activity(
    unit_id: int,
    req: StudentActivityRequest = Body(default=StudentActivityRequest(unit_id=0)),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_student),
):
    """
    Records student interaction when opening or interacting with a specific Note / Test / Assessment.
    Guarantees attendance is tied to authentic student action.
    """
    student = None
    if auth.user_id:
        student = db.query(Student).filter(Student.student_user_id == auth.user_id).first()
    if not student and auth.student_id:
        student = db.query(Student).filter(Student.id == auth.student_id).first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found for authenticated user.",
        )

    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unit {unit_id} not found.",
        )

    session = (
        db.query(ClassSession)
        .filter(ClassSession.unit_id == unit_id, ClassSession.is_active == True)
        .order_by(ClassSession.id.desc())
        .first()
    )
    if not session:
        teacher = db.query(User).filter(User.role == "teacher").first()
        session = ClassSession(
            teacher_user_id=teacher.id if teacher else 1,
            unit_id=unit.id,
            title=f"{unit.title} - Assessment",
            class_label="All",
            is_active=True,
        )
        db.add(session)
        db.flush()
    session_id = session.id

    # Upsert attendance for student + unit
    att = (
        db.query(Attendance)
        .filter(
            Attendance.student_id == student.id,
            (Attendance.unit_id == unit_id) | (Attendance.session_id == session_id if session_id else False)
        )
        .first()
    )
    act_type = req.activity_type or "opened_lesson"

    if att:
        att.status = "present"
        att.activity_type = act_type
        att.attended_at = utc_now()
        if session_id and not att.session_id:
            att.session_id = session_id
        if not att.unit_id:
            att.unit_id = unit_id
        if req.asset_id:
            att.asset_id = req.asset_id
    else:
        att = Attendance(
            student_id=student.id,
            unit_id=unit_id,
            asset_id=req.asset_id,
            session_id=session_id,
            status="present",
            activity_type=act_type,
            attended_at=utc_now(),
        )
        db.add(att)

    db.commit()
    db.refresh(att)

    return {
        "status": "present",
        "student_id": student.id,
        "unit_id": unit_id,
        "activity_type": act_type,
        "attended_at": att.attended_at.isoformat() if att.attended_at else None,
        "message": f"Activity recorded: {student.name} {act_type} for Unit {unit_id}.",
    }
