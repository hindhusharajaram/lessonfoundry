import secrets
from typing import Optional
from sqlalchemy.orm import Session
from db.models import User
from api.deps import AuthContext


def generate_join_code(db: Session, length: int = 8) -> str:
    """Generate a unique 8-character uppercase alphanumeric join code."""
    # Exclude easily confused characters like 'O', '0', 'I', '1'
    charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for _ in range(100):
        code = "".join(secrets.choice(charset) for _ in range(length))
        existing = db.query(User).filter(User.join_code == code).first()
        if not existing:
            return code
    raise RuntimeError("Failed to generate a unique join code after multiple attempts.")


def get_or_create_teacher_user(db: Session, auth: Optional[AuthContext] = None) -> User:
    """
    Resolves the current teacher user from AuthContext, or returns/creates
    the default teacher user in the database.
    """
    if auth and auth.user_id:
        user = db.query(User).filter(User.id == auth.user_id).first()
        if user and user.role == "teacher":
            if not user.join_code:
                user.join_code = generate_join_code(db)
                db.commit()
                db.refresh(user)
            return user

    teacher = db.query(User).filter(User.role == "teacher").first()
    if not teacher:
        teacher = User(
            email="teacher@lessonfoundry.edu",
            name="Teacher",
            role="teacher",
            join_code=generate_join_code(db),
        )
        db.add(teacher)
        db.commit()
        db.refresh(teacher)
    elif not teacher.join_code:
        teacher.join_code = generate_join_code(db)
        db.commit()
        db.refresh(teacher)

    return teacher
