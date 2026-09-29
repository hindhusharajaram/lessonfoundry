from unittest.mock import MagicMock, patch
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from db.database import Base
from db.models import (
    Asset,
    AssetVersion,
    Claim,
    Objective,
    QualityFlag,
    Slot,
    Source,
    SourceChunk,
    SourceVersion,
    Unit,
)
from engine.generator import (
    ExplanationContent,
    QuizItemContent,
    generate_slot,
    generate_unit_pack,
)
from engine.model import ModelError


@pytest.fixture
def test_setup():
    engine = create_engine("sqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Create test source
    src = Source(title="Photosynthesis Lab", filename="sample.txt")
    session.add(src)
    session.flush()

    s_ver = SourceVersion(
        source_id=src.id,
        version_no=1,
        text="Chloroplasts use sunlight to synthesize ATP and NADPH during light reactions.",
        sha256="sha256lab123",
    )
    session.add(s_ver)
    session.flush()

    chunk = SourceChunk(
        source_version_id=s_ver.id,
        idx=0,
        char_start=0,
        char_end=len(s_ver.text),
        text=s_ver.text,
    )
    session.add(chunk)
    session.flush()

    unit = Unit(
        title="Photosynthesis Lab Unit",
        source_id=src.id,
        pinned_source_version_id=s_ver.id,
        target_grade="High School",
        difficulty="medium",
    )
    session.add(unit)
    session.flush()

    obj = Objective(
        unit_id=unit.id,
        position=1,
        text="Explain ATP and NADPH generation in chloroplasts.",
        bloom_target="Understand",
        supported=True,
    )
    session.add(obj)
    session.flush()

    yield session, unit, obj, s_ver, chunk
    session.close()


def test_generator_saves_provenance_and_claims(test_setup):
    session, unit, obj, s_ver, chunk = test_setup

    slot = Slot(
        unit_id=unit.id,
        objective_id=obj.id,
        type="explanation",
        position=1,
        difficulty="medium",
        bloom_tag="Understand",
    )
    session.add(slot)
    session.flush()

    mock_explanation = ExplanationContent(
        title="ATP and NADPH Synthesis",
        summary="Chloroplasts capture light to produce energy carriers.",
        sentences=[
            {
                "text": "Chloroplasts use light to make ATP.",
                "quote": "Chloroplasts use sunlight to synthesize ATP and NADPH during light reactions.",
            },
            {
                "text": "NADPH is synthesized during the light reactions.",
                "quote": "Chloroplasts use sunlight to synthesize ATP and NADPH during light reactions.",
            },
            {
                "text": "Light energy is transferred into chemical energy.",
                "quote": "Chloroplasts use sunlight to synthesize ATP and NADPH during light reactions.",
            },
        ],
        glossary=[
            {
                "term": "Chloroplast",
                "definition": "Organelle that synthesizes ATP and NADPH.",
                "quote": "Chloroplasts use sunlight to synthesize ATP and NADPH during light reactions.",
            }
        ],
    )

    with patch("engine.generator.generate_json", return_value=(mock_explanation, {"model": "gemini-2.5-flash", "latency_ms": 400})):
        asset_ver = generate_slot(slot, session)

    assert asset_ver is not None
    assert asset_ver.version_no == 1
    assert asset_ver.model == "gemini-2.5-flash"
    assert asset_ver.source_version_id == s_ver.id
    assert asset_ver.source_sha256 == s_ver.sha256
    assert asset_ver.verification["all_verified"] is True
    assert asset_ver.verification["verified_claims"] == 4

    # Verify Claim rows in DB
    claims = session.query(Claim).filter_by(asset_version_id=asset_ver.id).all()
    assert len(claims) == 4
    for cl in claims:
        assert cl.verified is True
        assert cl.chunk_id == chunk.id
        assert cl.match_score == 1.0


def test_generator_failure_path_leaves_other_assets_intact_and_supports_resume(test_setup):
    session, unit, obj, s_ver, chunk = test_setup

    # Create two slots
    slot1 = Slot(unit_id=unit.id, objective_id=obj.id, type="explanation", position=1)
    slot2 = Slot(unit_id=unit.id, objective_id=obj.id, type="quiz_item", position=2)
    session.add_all([slot1, slot2])
    session.flush()

    asset1 = Asset(slot_id=slot1.id, status="draft", current_version_id=None)
    asset2 = Asset(slot_id=slot2.id, status="draft", current_version_id=None)
    session.add_all([asset1, asset2])
    session.commit()

    call_count = 0

    def mock_generate_slot(slot_arg, db_arg, **kwargs):
        nonlocal call_count
        call_count += 1
        if slot_arg.id == slot1.id:
            # Slot 1 succeeds
            av = AssetVersion(
                asset_id=slot1.asset.id,
                version_no=1,
                content={"title": "Success"},
                model="gemini-2.5-flash",
                source_version_id=s_ver.id,
                source_sha256=s_ver.sha256,
                verification={"all_verified": True},
            )
            session.add(av)
            session.flush()
            slot1.asset.current_version_id = av.id
            slot1.asset.status = "draft"
            session.commit()
            return av
        else:
            # Slot 2 fails with ModelError
            raise ModelError("Model rate limit exceeded on slot 2", model="gemini-2.5-flash")

    with patch("engine.generator.generate_slot", side_effect=mock_generate_slot):
        res = generate_unit_pack(unit.id, session)

    assert res["generated_count"] == 1
    assert res["failed_count"] == 1

    # Verify slot1 has draft asset and slot2 has generation_failed asset
    session.refresh(asset1)
    session.refresh(asset2)
    assert asset1.status == "draft"
    assert asset1.current_version_id is not None
    assert asset2.status == "generation_failed"

    # Test Resume: Running generate again should only attempt slot2 (slot1 skipped)
    call_count_resume = 0

    def mock_resume_slot(slot_arg, db_arg, **kwargs):
        nonlocal call_count_resume
        call_count_resume += 1
        av = AssetVersion(
            asset_id=slot2.asset.id,
            version_no=1,
            content={"question": "Success on resume"},
            model="gemini-2.5-flash",
            source_version_id=s_ver.id,
            source_sha256=s_ver.sha256,
            verification={"all_verified": True},
        )
        session.add(av)
        session.flush()
        slot2.asset.current_version_id = av.id
        slot2.asset.status = "draft"
        session.commit()
        return av

    with patch("engine.generator.generate_slot", side_effect=mock_resume_slot):
        resume_res = generate_unit_pack(unit.id, session)

    assert resume_res["skipped_count"] == 1  # Slot 1 was skipped
    assert resume_res["generated_count"] == 1  # Slot 2 was generated
    assert resume_res["failed_count"] == 0
    assert call_count_resume == 1
