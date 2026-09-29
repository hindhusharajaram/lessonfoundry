from unittest.mock import patch
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from db.database import Base
from db.models import Objective, QualityFlag, Slot, Source, SourceChunk, SourceVersion, Unit
from engine.planner import evaluate_objective_gap, plan_unit, ObjectiveSupportEvaluation


@pytest.fixture
def db_session():
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
        yield session
    finally:
        session.close()


def test_gap_detection_refuses_unsupported_objective(db_session):
    # Setup source and chunks
    src = Source(title="Photosynthesis", filename="photo.txt")
    db_session.add(src)
    db_session.flush()

    s_ver = SourceVersion(
        source_id=src.id,
        version_no=1,
        text="Chloroplasts contain thylakoids and chlorophyll to absorb sunlight.",
        sha256="fakehash123",
    )
    db_session.add(s_ver)
    db_session.flush()

    chunk1 = SourceChunk(
        source_version_id=s_ver.id,
        idx=0,
        char_start=0,
        char_end=len(s_ver.text),
        text=s_ver.text,
    )
    db_session.add(chunk1)
    db_session.flush()

    unit = Unit(
        title="Photosynthesis Unit",
        source_id=src.id,
        pinned_source_version_id=s_ver.id,
    )
    db_session.add(unit)
    db_session.flush()

    # 1. Supported objective with valid quote
    obj1 = Objective(
        unit_id=unit.id,
        position=1,
        text="Explain where chlorophyll is located inside chloroplasts.",
        bloom_target="Understand",
    )
    db_session.add(obj1)
    db_session.flush()

    mock_supported = ObjectiveSupportEvaluation(
        supported=True,
        reason="Source explicitly mentions chlorophyll in thylakoids.",
        evidence_quote="Chloroplasts contain thylakoids and chlorophyll to absorb sunlight.",
    )
    res1 = evaluate_objective_gap(obj1, [chunk1], db_session, mock_decision=mock_supported)
    assert res1 is True
    assert obj1.supported is True
    assert "Supported" in obj1.support_note

    # 2. Unsupported objective (e.g. quantum mechanics)
    obj2 = Objective(
        unit_id=unit.id,
        position=2,
        text="Calculate quantum wavefunction collapse of photons.",
        bloom_target="Analyze",
    )
    db_session.add(obj2)
    db_session.flush()

    mock_unsupported = ObjectiveSupportEvaluation(
        supported=False,
        reason="Source contains no information about quantum wavefunction calculations.",
        evidence_quote="",
    )
    res2 = evaluate_objective_gap(obj2, [chunk1], db_session, mock_decision=mock_unsupported)
    assert res2 is False
    assert obj2.supported is False
    assert "quantum" in obj2.support_note

    # Verify quality flag was created for unsupported objective
    flags = db_session.query(QualityFlag).filter_by(unit_id=unit.id, code="objective_unsupported").all()
    assert len(flags) == 1
    assert "quantum" in flags[0].message


def test_planner_blueprint_creates_slots_only_for_supported_objectives(db_session):
    src = Source(title="Photosynthesis", filename="photo.txt")
    db_session.add(src)
    db_session.flush()

    s_ver = SourceVersion(
        source_id=src.id,
        version_no=1,
        text="Photosystem II splits water into oxygen and protons. Calvin cycle fixes CO2 into sugar.",
        sha256="hash456",
    )
    db_session.add(s_ver)
    db_session.flush()

    chunk1 = SourceChunk(
        source_version_id=s_ver.id,
        idx=0,
        char_start=0,
        char_end=len(s_ver.text),
        text=s_ver.text,
    )
    db_session.add(chunk1)
    db_session.flush()

    unit = Unit(
        title="Unit 1",
        source_id=src.id,
        pinned_source_version_id=s_ver.id,
        difficulty="medium",
        quiz_count=5,
    )
    db_session.add(unit)
    db_session.flush()

    obj1 = Objective(unit_id=unit.id, position=1, text="Explain light reactions in Photosystem II.")
    obj2 = Objective(unit_id=unit.id, position=2, text="Describe carbon fixation in Calvin cycle.")
    obj3 = Objective(unit_id=unit.id, position=3, text="Solve quadratic differential equations.")
    db_session.add_all([obj1, obj2, obj3])
    db_session.flush()

    def mock_eval(obj, chunks, db_sess):
        if "quadratic" in obj.text:
            obj.supported = False
            obj.support_note = "Mathematics out of scope"
            return False
        obj.supported = True
        obj.support_note = "Supported by text"
        return True

    with patch("engine.planner.evaluate_objective_gap", side_effect=mock_eval):
        plan_res = plan_unit(unit, db_session)

    assert plan_res["supported_objectives_count"] == 2
    assert plan_res["unsupported_objectives_count"] == 1
    assert plan_res["slots_count"] > 0

    # Ensure NO slots are mapped to obj3 (the unsupported objective)
    obj3_slots = db_session.query(Slot).filter_by(objective_id=obj3.id).all()
    assert len(obj3_slots) == 0

    # Check blueprint structure: every created slot must have an objective and an empty asset
    created_slots = db_session.query(Slot).filter_by(unit_id=unit.id).all()
    for slot in created_slots:
        assert slot.objective_id in [obj1.id, obj2.id]
        assert slot.asset is not None
        assert slot.asset.status == "draft"
        assert slot.asset.current_version_id is None
