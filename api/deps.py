from typing import Optional
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.orm import Session
from db.database import get_db


class AuthContext:
    def __init__(
        self,
        role: str,
        student_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ):
        self.role = role
        self.student_id = student_id
        self.user_id = user_id

    @property
    def is_teacher(self) -> bool:
        return self.role.lower() == "teacher"

    @property
    def is_student(self) -> bool:
        return self.role.lower() == "student"


def get_current_user(
    x_role: Optional[str] = Header(default="teacher", alias="X-Role"),
    x_student_id: Optional[str] = Header(default=None, alias="X-Student-Id"),
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_user_email: Optional[str] = Header(default=None, alias="X-User-Email"),
    db: Session = Depends(get_db),
) -> AuthContext:
    """
    Authentication dependency using headers:
    - X-Role: 'teacher' (default) or 'student'
    - X-Student-Id: numeric student profile id
    - X-User-Id: numeric user account id
    - X-User-Email: user account email
    """
    role = (x_role or "teacher").strip().lower()
    if role not in ["teacher", "student"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid X-Role: '{role}'. Must be 'teacher' or 'student'.",
        )
    
    user_id_int: Optional[int] = None
    if x_user_id:
        try:
            user_id_int = int(x_user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="X-User-Id must be an integer.",
            )

    student_id_int: Optional[int] = None
    if x_student_id:
        try:
            student_id_int = int(x_student_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="X-Student-Id must be an integer.",
            )

    if not user_id_int and x_user_email:
        clean_email = x_user_email.strip().lower()
        from db.models import User, Student
        user = db.query(User).filter(User.email == clean_email).first()
        if user:
            user_id_int = user.id
            if role == "student" and not student_id_int:
                st = db.query(Student).filter(Student.student_user_id == user.id).first()
                if st:
                    student_id_int = st.id

    if user_id_int and role == "student" and not student_id_int:
        from db.models import Student
        st = db.query(Student).filter(Student.student_user_id == user_id_int).first()
        if st:
            student_id_int = st.id

    return AuthContext(role=role, student_id=student_id_int, user_id=user_id_int)


def require_teacher(auth: AuthContext = Depends(get_current_user)) -> AuthContext:
    if not auth.is_teacher:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher role required for this action.",
        )
    return auth


def require_student(auth: AuthContext = Depends(get_current_user)) -> AuthContext:
    if not auth.is_student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student role required for this action.",
        )
    return auth
