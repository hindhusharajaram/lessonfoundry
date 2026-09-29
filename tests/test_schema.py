import pytest
from sqlalchemy import create_engine, inspect, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from db.database import Base
from db.models import (
    Source,
    SourceVersion,
    SourceChunk,
    Unit,
    Objective,
    Slot,
    Asset,
    AssetVersion,
    Claim,
    QualityFlag,
    Feedback,
    DecisionLog,
    Student,
    QuizAttempt,
    AttemptAnswer,
    Publication,
)


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session, engine
    finally:
        session.close()


def test_all_tables_exist(test_db):
    _, engine = test_db
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    
    expected_tables = {
        "sources",
        "source_versions",
        "source_chunks",
        "units",
        "objectives",
        "slots",
        "assets",
        "asset_versions",
        "claims",
        "quality_flags",
        "feedbacks",
        "decision_logs",
        "students",
        "quiz_attempts",
        "attempt_answers",
        "publications",
    }
    
    assert expected_tables.issubset(tables), f"Missing tables: {expected_tables - tables}"


def test_slot_objective_id_is_non_nullable(test_db):
    session, _ = test_db
    
    # Create source & unit
    src = Source(title="Test Source", filename="test.pdf")
    session.add(src)
    session.flush()
    
    unit = Unit(title="Test Unit", source_id=src.id)
    session.add(unit)
    session.flush()
    
    # Attempt to add Slot without objective_id
    with pytest.raises(IntegrityError):
        invalid_slot = Slot(
            unit_id=unit.id,
            objective_id=None,  # Spec requirement: Slot.objective_id NOT NULL
            type="explanation",
            position=0,
        )
        session.add(invalid_slot)
        session.flush()
    session.rollback()


def test_foreign_key_constraints_enforced(test_db):
    session, _ = test_db
    
    # Attempt to insert Objective for nonexistent Unit
    with pytest.raises(IntegrityError):
        invalid_obj = Objective(
            unit_id=99999,
            text="Nonexistent Unit Objective",
            position=0,
        )
        session.add(invalid_obj)
        session.flush()
    session.rollback()


def test_full_pack_relational_creation(test_db):
    session, _ = test_db
    
    # 1. Source & Version & Chunk
    source = Source(title="Photosynthesis Overview", filename="biology_ch3.pdf")
    session.add(source)
    session.flush()

    source_ver = SourceVersion(
        source_id=source.id,
        version_no=1,
        text="Plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar.",
        sha256="abc123sha256hash",
    )
    session.add(source_ver)
    session.flush()

    chunk = SourceChunk(
        source_version_id=source_ver.id,
        idx=0,
        char_start=0,
        char_end=96,
        text=source_ver.text,
    )
    session.add(chunk)
    session.flush()

    # 2. Unit
    unit = Unit(
        title="Unit 1: Photosynthesis",
        source_id=source.id,
        pinned_source_version_id=source_ver.id,
        target_grade="9th Grade",
    )
    session.add(unit)
    session.flush()

    # 3. Objective
    obj = Objective(
        unit_id=unit.id,
        position=1,
        text="Explain how light energy is converted into chemical energy.",
        bloom_target="Understand",
        supported=True,
    )
    session.add(obj)
    session.flush()

    # 4. Slot
    slot = Slot(
        unit_id=unit.id,
        objective_id=obj.id,
        type="explanation",
        position=1,
    )
    session.add(slot)
    session.flush()

    # 5. Asset & Version & Claim
    asset = Asset(slot_id=slot.id, status="draft", locked=False)
    session.add(asset)
    session.flush()

    asset_ver = AssetVersion(
        asset_id=asset.id,
        version_no=1,
        variant="standard",
        content={
            "title": "Photosynthesis Basics",
            "summary": "Photosynthesis is the process by which plants make food.",
            "sentences": [{"text": "Plants use sunlight to make oxygen.", "quote": "Plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar."}],
            "glossary": []
        },
        model="gemini-2.5-flash",
        prompt_version="1.0",
        source_version_id=source_ver.id,
        source_sha256=source_ver.sha256,
    )
    session.add(asset_ver)
    session.flush()

    asset.current_version_id = asset_ver.id
    session.flush()

    claim = Claim(
        asset_version_id=asset_ver.id,
        text="Plants use sunlight to make oxygen.",
        source_quote="Plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar.",
        chunk_id=chunk.id,
        verified=True,
        match_score=1.0,
    )
    session.add(claim)
    session.flush()

    # 6. Quality Flag, Feedback, DecisionLog
    flag = QualityFlag(
        unit_id=unit.id,
        asset_version_id=asset_ver.id,
        code="info_check",
        severity="info",
        message="Initial verification complete",
    )
    fb = Feedback(asset_id=asset.id, note="Initial draft looks good.")
    dlog = DecisionLog(unit_id=unit.id, asset_id=asset.id, action="create_draft", actor="teacher")
    session.add_all([flag, fb, dlog])
    session.flush()

    # 7. Student, Attempt, Answer, Publication
    student = Student(name="Jane Doe", class_label="Biology 101", synthetic=True)
    session.add(student)
    session.flush()

    attempt = QuizAttempt(student_id=student.id, unit_id=unit.id, score=100.0)
    session.add(attempt)
    session.flush()

    ans = AttemptAnswer(attempt_id=attempt.id, asset_id=asset.id, chosen_index=0, correct=True, time_seconds=15)
    pub = Publication(unit_id=unit.id, class_label="Biology 101", snapshot={"assets": [asset_ver.id]})
    session.add_all([ans, pub])
    session.commit()

    # Verify query
    loaded_unit = session.query(Unit).filter_by(id=unit.id).first()
    assert loaded_unit is not None
    assert len(loaded_unit.objectives) == 1
    assert len(loaded_unit.slots) == 1
    assert loaded_unit.slots[0].asset.current_version.claims[0].verified is True
