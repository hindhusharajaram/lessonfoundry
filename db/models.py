from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    versions: Mapped[List["SourceVersion"]] = relationship(
        "SourceVersion", back_populates="source", cascade="all, delete-orphan"
    )
    units: Mapped[List["Unit"]] = relationship("Unit", back_populates="source")


class SourceVersion(Base):
    __tablename__ = "source_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sources.id", ondelete="CASCADE"), nullable=False
    )
    version_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    injection_flags: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    source: Mapped["Source"] = relationship("Source", back_populates="versions")
    chunks: Mapped[List["SourceChunk"]] = relationship(
        "SourceChunk", back_populates="source_version", cascade="all, delete-orphan"
    )


class SourceChunk(Base):
    __tablename__ = "source_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_version_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("source_versions.id", ondelete="CASCADE"), nullable=False
    )
    idx: Mapped[int] = mapped_column(Integer, nullable=False)
    char_start: Mapped[int] = mapped_column(Integer, nullable=False)
    char_end: Mapped[int] = mapped_column(Integer, nullable=False)
    page: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    source_version: Mapped["SourceVersion"] = relationship("SourceVersion", back_populates="chunks")
    claims: Mapped[List["Claim"]] = relationship("Claim", back_populates="chunk")


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sources.id", ondelete="RESTRICT"), nullable=False
    )
    pinned_source_version_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("source_versions.id", ondelete="SET NULL"), nullable=True
    )
    target_grade: Mapped[str] = mapped_column(String(50), default="High School")
    difficulty: Mapped[str] = mapped_column(String(50), default="Medium")
    language: Mapped[str] = mapped_column(String(50), default="English")
    answer_visibility: Mapped[str] = mapped_column(String(50), default="after_submission")
    constraints: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)
    quiz_count: Mapped[int] = mapped_column(Integer, default=5)
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, planning, generated, published
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    source: Mapped["Source"] = relationship("Source", back_populates="units")
    pinned_source_version: Mapped[Optional["SourceVersion"]] = relationship("SourceVersion")
    objectives: Mapped[List["Objective"]] = relationship(
        "Objective", back_populates="unit", cascade="all, delete-orphan", order_by="Objective.position"
    )
    slots: Mapped[List["Slot"]] = relationship(
        "Slot", back_populates="unit", cascade="all, delete-orphan", order_by="Slot.position"
    )
    quality_flags: Mapped[List["QualityFlag"]] = relationship(
        "QualityFlag", back_populates="unit", cascade="all, delete-orphan"
    )
    decision_logs: Mapped[List["DecisionLog"]] = relationship(
        "DecisionLog", back_populates="unit", cascade="all, delete-orphan"
    )
    publications: Mapped[List["Publication"]] = relationship(
        "Publication", back_populates="unit", cascade="all, delete-orphan"
    )
    quiz_attempts: Mapped[List["QuizAttempt"]] = relationship(
        "QuizAttempt", back_populates="unit", cascade="all, delete-orphan"
    )


class Objective(Base):
    __tablename__ = "objectives"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    unit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("units.id", ondelete="CASCADE"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    bloom_target: Mapped[str] = mapped_column(String(50), default="Understand")
    supported: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    support_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    unit: Mapped["Unit"] = relationship("Unit", back_populates="objectives")
    slots: Mapped[List["Slot"]] = relationship(
        "Slot", back_populates="objective", cascade="all, delete-orphan"
    )


class Slot(Base):
    __tablename__ = "slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    unit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("units.id", ondelete="CASCADE"), nullable=False
    )
    # Spec Rule: Every Slot has an objective (no orphans), objective_id NOT NULL
    objective_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("objectives.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # explanation | example | quiz_item | practice_foundation | practice_advanced | revision
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    difficulty: Mapped[str] = mapped_column(String(50), default="Medium")
    bloom_tag: Mapped[str] = mapped_column(String(50), default="Understand")

    unit: Mapped["Unit"] = relationship("Unit", back_populates="slots")
    objective: Mapped["Objective"] = relationship("Objective", back_populates="slots")
    asset: Mapped[Optional["Asset"]] = relationship(
        "Asset", back_populates="slot", uselist=False, cascade="all, delete-orphan"
    )


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("slots.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    status: Mapped[str] = mapped_column(
        String(50), default="draft"
    )  # draft | approved | needs_revision | generation_failed
    locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    current_version_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("asset_versions.id", ondelete="SET NULL", use_alter=True, name="fk_asset_current_version"), nullable=True
    )

    slot: Mapped["Slot"] = relationship("Slot", back_populates="asset")
    versions: Mapped[List["AssetVersion"]] = relationship(
        "AssetVersion",
        back_populates="asset",
        cascade="all, delete-orphan",
        foreign_keys="AssetVersion.asset_id",
        order_by="AssetVersion.version_no",
    )
    current_version: Mapped[Optional["AssetVersion"]] = relationship(
        "AssetVersion", foreign_keys=[current_version_id], post_update=True
    )
    feedbacks: Mapped[List["Feedback"]] = relationship(
        "Feedback", back_populates="asset", cascade="all, delete-orphan"
    )
    decision_logs: Mapped[List["DecisionLog"]] = relationship(
        "DecisionLog", back_populates="asset"
    )
    attempt_answers: Mapped[List["AttemptAnswer"]] = relationship(
        "AttemptAnswer", back_populates="asset"
    )


class AssetVersion(Base):
    __tablename__ = "asset_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False
    )
    version_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    parent_version_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("asset_versions.id", ondelete="SET NULL"), nullable=True
    )
    variant: Mapped[str] = mapped_column(String(50), default="standard")  # standard | simplified
    content: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(50), default="1.0")
    settings: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    source_version_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("source_versions.id", ondelete="SET NULL"), nullable=True
    )
    source_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    verification: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    asset: Mapped["Asset"] = relationship(
        "Asset", back_populates="versions", foreign_keys=[asset_id]
    )
    parent_version: Mapped[Optional["AssetVersion"]] = relationship(
        "AssetVersion", remote_side=[id]
    )
    claims: Mapped[List["Claim"]] = relationship(
        "Claim", back_populates="asset_version", cascade="all, delete-orphan"
    )
    quality_flags: Mapped[List["QualityFlag"]] = relationship(
        "QualityFlag", back_populates="asset_version"
    )


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_version_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("asset_versions.id", ondelete="CASCADE"), nullable=False
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    source_quote: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("source_chunks.id", ondelete="SET NULL"), nullable=True
    )
    char_start: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    char_end: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    match_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    asset_version: Mapped["AssetVersion"] = relationship("AssetVersion", back_populates="claims")
    chunk: Mapped[Optional["SourceChunk"]] = relationship("SourceChunk", back_populates="claims")


class QualityFlag(Base):
    __tablename__ = "quality_flags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    unit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("units.id", ondelete="CASCADE"), nullable=False
    )
    asset_version_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("asset_versions.id", ondelete="SET NULL"), nullable=True
    )
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="warning")  # info | warning | error
    message: Mapped[str] = mapped_column(Text, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    unit: Mapped["Unit"] = relationship("Unit", back_populates="quality_flags")
    asset_version: Mapped[Optional["AssetVersion"]] = relationship(
        "AssetVersion", back_populates="quality_flags"
    )


class Feedback(Base):
    __tablename__ = "feedbacks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False
    )
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    asset: Mapped["Asset"] = relationship("Asset", back_populates="feedbacks")


class DecisionLog(Base):
    __tablename__ = "decision_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    unit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("units.id", ondelete="CASCADE"), nullable=False
    )
    asset_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    actor: Mapped[str] = mapped_column(String(100), default="teacher")
    detail: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    unit: Mapped["Unit"] = relationship("Unit", back_populates="decision_logs")
    asset: Mapped[Optional["Asset"]] = relationship("Asset", back_populates="decision_logs")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="teacher", nullable=False)  # "teacher" or "student"
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    join_code: Mapped[Optional[str]] = mapped_column(String(16), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    enrollments_as_teacher: Mapped[List["Enrollment"]] = relationship(
        "Enrollment", foreign_keys="Enrollment.teacher_user_id", back_populates="teacher", cascade="all, delete-orphan"
    )
    enrollments_as_student: Mapped[List["Enrollment"]] = relationship(
        "Enrollment", foreign_keys="Enrollment.student_user_id", back_populates="student_user", cascade="all, delete-orphan"
    )
    student_profiles: Mapped[List["Student"]] = relationship(
        "Student", back_populates="user", cascade="all, delete-orphan"
    )


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("teacher_user_id", "student_user_id", name="uq_teacher_student_enrollment"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    teacher_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    student_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    teacher: Mapped["User"] = relationship(
        "User", foreign_keys=[teacher_user_id], back_populates="enrollments_as_teacher"
    )
    student_user: Mapped["User"] = relationship(
        "User", foreign_keys=[student_user_id], back_populates="enrollments_as_student"
    )


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    class_label: Mapped[str] = mapped_column(String(100), default="Class A")
    synthetic: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="student_profiles")
    attempts: Mapped[List["QuizAttempt"]] = relationship(
        "QuizAttempt", back_populates="student", cascade="all, delete-orphan"
    )


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    unit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("units.id", ondelete="CASCADE"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    student: Mapped["Student"] = relationship("Student", back_populates="attempts")
    unit: Mapped["Unit"] = relationship("Unit", back_populates="quiz_attempts")
    answers: Mapped[List["AttemptAnswer"]] = relationship(
        "AttemptAnswer", back_populates="attempt", cascade="all, delete-orphan"
    )


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    attempt_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False
    )
    asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False
    )
    chosen_index: Mapped[int] = mapped_column(Integer, nullable=False)
    correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    time_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    attempt: Mapped["QuizAttempt"] = relationship("QuizAttempt", back_populates="answers")
    asset: Mapped["Asset"] = relationship("Asset", back_populates="attempt_answers")


class Publication(Base):
    __tablename__ = "publications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    unit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("units.id", ondelete="CASCADE"), nullable=False
    )
    class_label: Mapped[str] = mapped_column(String(100), default="All")
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    snapshot: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)

    unit: Mapped["Unit"] = relationship("Unit", back_populates="publications")
