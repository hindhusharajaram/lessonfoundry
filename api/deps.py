from typing import Optional
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.orm import Session
from db.database import get_db


class AuthContext:
    def __init__(self, role: str, student_id: Optional[int] = None):
        self.role = role
        self.student_id = student_id

    @property
    def is_teacher(self) -> bool:
        return self.role.lower() == "teacher"

    @property
    def is_student(self) -> bool:
        return self.role.lower() == "student"


def get_current_user(
    x_role: Optional[str] = Header(default="teacher", alias="X-Role"),
    x_student_id: Optional[str] = Header(default=None, alias="X-Student-Id"),
) -> AuthContext:
    """
    Demo authentication dependency using headers:
    - X-Role: 'teacher' (default) or 'student'
    - X-Student-Id: numeric id if role is student
    """
    role = (x_role or "teacher").strip().lower()
    if role not in ["teacher", "student"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid X-Role: '{role}'. Must be 'teacher' or 'student'.",
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

    return AuthContext(role=role, student_id=student_id_int)


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
