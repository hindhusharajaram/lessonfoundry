from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import User, Student, Enrollment
from api.auth_utils import generate_join_code

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: Optional[str] = "password123"
    role: str = "student"  # "student" or "teacher"
    join_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(
    req: RegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Registers a new user (teacher or student).
    If role is 'student' and join_code is provided:
    - Verifies the join_code matches an active teacher.
    - Creates Enrollment link between student and teacher.
    - Creates a linked Student record (synthetic=False, student_user_id=user.id).
    - If join_code is invalid, returns 400 Bad Request.
    """
    clean_email = req.email.strip().lower()
    clean_name = req.name.strip()
    role = req.role.strip().lower()

    if role not in ["teacher", "student"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{role}'. Must be 'teacher' or 'student'.",
        )

    teacher = None
    if role == "student" and req.join_code:
        code = req.join_code.strip().upper()
        teacher = db.query(User).filter(User.join_code == code, User.role == "teacher").first()
        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid join code '{req.join_code}'. Teacher not found.",
            )

    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Create User
    new_user = User(
        email=clean_email,
        name=clean_name,
        role=role,
        hashed_password=req.password,
    )
    if role == "teacher":
        new_user.join_code = generate_join_code(db)

    db.add(new_user)
    db.flush()

    student_id = None
    if role == "student":
        student_record = Student(
            student_user_id=new_user.id,
            name=new_user.name,
            class_label=f"Class {teacher.name}" if teacher else "Class A",
            synthetic=False,
        )
        db.add(student_record)
        db.flush()
        student_id = student_record.id

        if teacher:
            enrollment = Enrollment(
                teacher_user_id=teacher.id,
                student_user_id=new_user.id,
            )
            db.add(enrollment)
            db.flush()

    db.commit()
    db.refresh(new_user)

    return {
        "user_id": new_user.id,
        "name": new_user.name,
        "email": new_user.email,
        "role": new_user.role,
        "join_code": new_user.join_code,
        "student_id": student_id,
        "enrolled_teacher_id": teacher.id if teacher else None,
        "token": f"lf_session_{new_user.id}_{new_user.role}",
        "message": "User registered successfully.",
    }


@router.post("/login")
def login_user(
    req: LoginRequest,
    db: Session = Depends(get_db),
):
    """Logs in an existing user by email."""
    clean_email = req.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found with provided email.",
        )

    student_id = None
    if user.role == "student":
        st = db.query(Student).filter(Student.student_user_id == user.id).first()
        student_id = st.id if st else None

    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "join_code": user.join_code,
        "student_id": student_id,
        "token": f"lf_session_{user.id}_{user.role}",
    }
