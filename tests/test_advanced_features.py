from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from api.main import app
from db.database import Base, SessionLocal, engine
from db.models import (
    Asset,
    AssetVersion,
    Claim,
    DecisionLog,
    Objective,
    Publication,
    QualityFlag,
    QuizAttempt,
    Slot,
    Source,
    SourceChunk,
    SourceVersion,
    Student,
    Unit,
)
from engine.guardrails import run_unit_guardrails, calculate_pack_health
from engine.impact import analyze_change_impact
from engine.solver import SolverAnswer, verify_asset_with_solver

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_db():
    session = SessionLocal()
    try:
        session.query(QualityFlag).delete()
        session.query(DecisionLog).delete()
        session.query(Publication).delete()
        session.query(Claim).delete()
        session.query(AssetVersion).delete()
        session.query(Asset).delete()
        session.query(Slot).delete()
        session.query(Objective).delete()
        session.query(Unit).delete()
        session.query(SourceChunk).delete()
        session.query(SourceVersion).delete()
        session.query(Source).delete()
        session.commit()
    finally:
        session.close()
    yield


def test_approval_gate_enforces_quality_and_logs_overrides():
    session = SessionLocal()
    src = Source(title="Bio Doc", filename="bio.txt")
    session.add(src)
    session.flush()

    s_ver = SourceVersion(source_id=src.id, version_no=1, text="Chloroplasts contain chlorophyll.", sha256="h1")
    session.add(s_ver)
    session.flush()

    unit = Unit(title="Test Unit", source_id=src.id, pinned_source_version_id=s_ver.id)
    session.add(unit)
    session.flush()

    obj = Objective(unit_id=unit.id, position=1, text="Objective 1", supported=True)
    session.add(obj)
    session.flush()

    slot = Slot(unit_id=unit.id, objective_id=obj.id, type="explanation", position=1)
    session.add(slot)
    session.flush()

    asset = Asset(slot_id=slot.id, status="draft", locked=False)
    session.add(asset)
    session.flush()

    av = AssetVersion(
        asset_id=asset.id,
        version_no=1,
        content={"title": "Test Exp", "sentences": []},
        model="gemini-2.5-flash",
        source_version_id=s_ver.id,
        source_sha256=s_ver.sha256,
        verification={"all_verified": False},
    )
    session.add(av)
    session.flush()

    asset.current_version_id = av.id

    # Add an unverified claim
    unver_claim = Claim(
        asset_version_id=av.id,
        text="Unverified claim text",
        source_quote="Fabricated text",
        verified=False,
        match_score=0.2,
    )
    session.add(unver_claim)
    session.commit()

    asset_id = asset.id
    session.close()

    # 1. Attempting to approve without override => 409 Conflict
    res_block = client.post(
        f"/api/assets/{asset_id}/status",
        json={"status": "approved", "override": False},
        headers={"X-Role": "teacher"},
    )
    assert res_block.status_code == 409
    assert "Approval refused" in res_block.json()["detail"]["message"]

    # 2. Attempting to approve with override=True but empty reason => 400 Bad Request
    res_empty_reason = client.post(
        f"/api/assets/{asset_id}/status",
        json={"status": "approved", "override": True, "override_reason": ""},
        headers={"X-Role": "teacher"},
    )
    assert res_empty_reason.status_code == 400

    # 3. Approve with override=True and valid reason => 200 Success & Logged
    res_override = client.post(
        f"/api/assets/{asset_id}/status",
        json={
            "status": "approved",
            "override": True,
            "override_reason": "Teacher verified factual validity manually in supplemental lab notes.",
            "note": "Approved by senior instructor",
        },
        headers={"X-Role": "teacher"},
    )
    assert res_override.status_code == 200
    assert res_override.json()["status"] == "approved"
    assert res_override.json()["locked"] is True

    # Check DecisionLog entry
    session = SessionLocal()
    d_log = session.query(DecisionLog).filter_by(asset_id=asset_id, action="approve_override").first()
    assert d_log is not None
    assert "supplemental lab notes" in d_log.detail["reason"]
    session.close()


def test_regeneration_preserves_locked_and_creates_new_version():
    session = SessionLocal()
    src = Source(title="Doc", filename="doc.txt")
    session.add(src)
    session.flush()

    s_ver = SourceVersion(source_id=src.id, version_no=1, text="Photosynthesis text.", sha256="h2")
    session.add(s_ver)
    session.flush()

    chunk = SourceChunk(source_version_id=s_ver.id, idx=0, char_start=0, char_end=len(s_ver.text), text=s_ver.text)
    session.add(chunk)
    session.flush()

    unit = Unit(title="Unit", source_id=src.id, pinned_source_version_id=s_ver.id)
    session.add(unit)
    session.flush()

    obj = Objective(unit_id=unit.id, position=1, text="Obj", supported=True)
    session.add(obj)
    session.flush()

    slot = Slot(unit_id=unit.id, objective_id=obj.id, type="explanation", position=1)
    session.add(slot)
    session.flush()

    asset = Asset(slot_id=slot.id, status="approved", locked=True)
    session.add(asset)
    session.flush()

    av1 = AssetVersion(
        asset_id=asset.id,
        version_no=1,
        content={"title": "Version 1"},
        model="gemini-2.5-flash",
        source_version_id=s_ver.id,
        source_sha256=s_ver.sha256,
        verification={"all_verified": True},
    )
    session.add(av1)
    session.flush()
    asset.current_version_id = av1.id
    session.commit()

    asset_id = asset.id
    av1_id = av1.id
    session.close()

    # 1. Regenerating approved/locked asset is refused => 409 Conflict
    res_refuse = client.post(
        f"/api/assets/{asset_id}/regenerate",
        json={"feedback": "Make it shorter"},
        headers={"X-Role": "teacher"},
    )
    assert res_refuse.status_code == 409

    # 2. Teacher sets needs_revision
    client.post(
        f"/api/assets/{asset_id}/status",
        json={"status": "needs_revision"},
        headers={"X-Role": "teacher"},
    )

    # 3. Regenerate creates version 2 with parent_version_id = av1_id
    from engine.generator import ExplanationContent
    mock_new_exp = ExplanationContent(
        title="Version 2 Updated",
        summary="Summary v2",
        sentences=[
            {"text": "Photosynthesis text sentence 1.", "quote": "Photosynthesis text."},
            {"text": "Photosynthesis text sentence 2.", "quote": "Photosynthesis text."},
            {"text": "Photosynthesis text sentence 3.", "quote": "Photosynthesis text."},
        ],
        glossary=[{"term": "Photosynthesis", "definition": "Process", "quote": "Photosynthesis text."}],
    )

    with patch("engine.generator.generate_json", return_value=(mock_new_exp, {"model": "gemini-2.5-flash", "latency_ms": 200})):
        res_regen = client.post(
            f"/api/assets/{asset_id}/regenerate",
            json={"feedback": "Include glossary"},
            headers={"X-Role": "teacher"},
        )
    assert res_regen.status_code == 200
    assert res_regen.json()["version_no"] == 2
    assert res_regen.json()["parent_version_id"] == av1_id


def test_independent_solver_detects_mismatch():
    session = SessionLocal()
    src = Source(title="Doc", filename="doc.txt")
    session.add(src)
    session.flush()

    s_ver = SourceVersion(source_id=src.id, version_no=1, text="Chloroplasts synthesize ATP and NADPH.", sha256="h3")
    session.add(s_ver)
    session.flush()

    chunk = SourceChunk(source_version_id=s_ver.id, idx=0, char_start=0, char_end=len(s_ver.text), text=s_ver.text)
    session.add(chunk)
    session.flush()

    unit = Unit(title="Unit", source_id=src.id, pinned_source_version_id=s_ver.id)
    session.add(unit)
    session.flush()

    obj = Objective(unit_id=unit.id, position=1, text="Obj", supported=True)
    session.add(obj)
    session.flush()

    slot = Slot(unit_id=unit.id, objective_id=obj.id, type="quiz_item", position=1)
    session.add(slot)
    session.flush()

    asset = Asset(slot_id=slot.id, status="draft", locked=False)
    session.add(asset)
    session.flush()

    # Generator set Option 0 as answer key
    av = AssetVersion(
        asset_id=asset.id,
        version_no=1,
        content={
            "question": "What is synthesized in chloroplasts?",
            "options": ["ATP and NADPH", "Glucose only", "Lipids", "Proteins"],
            "correct_index": 0,
            "rationale": "Directly stated in source.",
            "quote": "Chloroplasts synthesize ATP and NADPH.",
        },
        model="gemini-2.5-flash",
        source_version_id=s_ver.id,
        source_sha256=s_ver.sha256,
        verification={},
    )
    session.add(av)
    session.flush()
    asset.current_version_id = av.id
    session.commit()

    # 1. Matching Solver
    mock_match = SolverAnswer(
        chosen_index=0,
        supporting_quote="Chloroplasts synthesize ATP and NADPH.",
        rationale="Source confirms ATP and NADPH synthesis.",
    )
    res_match = verify_asset_with_solver(slot, av, session, mock_answer=mock_match)
    assert res_match["matches_key"] is True
    assert res_match["quote_verified"] is True

    # 2. Mismatching Solver (Solver chooses Option 1 instead of Key Option 0)
    mock_mismatch = SolverAnswer(
        chosen_index=1,
        supporting_quote="Chloroplasts synthesize ATP and NADPH.",
        rationale="I mistakenly picked Glucose only.",
    )
    res_mismatch = verify_asset_with_solver(slot, av, session, mock_answer=mock_mismatch)
    assert res_mismatch["matches_key"] is False

    # Check QualityFlag created
    flags = session.query(QualityFlag).filter_by(asset_version_id=av.id, code="answer_key_mismatch").all()
    assert len(flags) == 1
    assert "Option 1" in flags[0].message
    session.close()


def test_guardrails_leakage_duplicate_malformed_key():
    session = SessionLocal()
    src = Source(title="Doc", filename="doc.txt")
    session.add(src)
    session.flush()

    s_ver = SourceVersion(source_id=src.id, version_no=1, text="Source facts text.", sha256="h4")
    session.add(s_ver)
    session.flush()

    unit = Unit(title="Unit", source_id=src.id, pinned_source_version_id=s_ver.id)
    session.add(unit)
    session.flush()

    obj1 = Objective(unit_id=unit.id, position=1, text="Obj 1", supported=True)
    obj2 = Objective(unit_id=unit.id, position=2, text="Obj 2", supported=True)
    session.add_all([obj1, obj2])
    session.flush()

    # Slot 1: Answer leakage (question stem contains correct option)
    s1 = Slot(unit_id=unit.id, objective_id=obj1.id, type="quiz_item", position=1)
    # Slot 2: Near duplicate of Slot 1
    s2 = Slot(unit_id=unit.id, objective_id=obj1.id, type="quiz_item", position=2)
    # Slot 3: Malformed key (only 3 options)
    s3 = Slot(unit_id=unit.id, objective_id=obj1.id, type="quiz_item", position=3)
    session.add_all([s1, s2, s3])
    session.flush()

    a1 = Asset(slot_id=s1.id, status="draft")
    a2 = Asset(slot_id=s2.id, status="draft")
    a3 = Asset(slot_id=s3.id, status="draft")
    session.add_all([a1, a2, a3])
    session.flush()

    av1 = AssetVersion(
        asset_id=a1.id,
        version_no=1,
        content={
            "question": "What organelle contains chlorophyll in green plants?",
            "options": ["chlorophyll", "Nucleus", "Ribosome", "Vacuole"],
            "correct_index": 0,  # 'chlorophyll' is in the question!
        },
        model="gemini",
        source_version_id=s_ver.id,
        source_sha256="h4",
        verification={},
    )
    av2 = AssetVersion(
        asset_id=a2.id,
        version_no=1,
        content={
            "question": "What organelle contains chlorophyll in green plants?",  # Duplicate of Q1
            "options": ["Chloroplast", "Nucleus", "Ribosome", "Mitochondria"],
            "correct_index": 0,
        },
        model="gemini",
        source_version_id=s_ver.id,
        source_sha256="h4",
        verification={},
    )
    av3 = AssetVersion(
        asset_id=a3.id,
        version_no=1,
        content={
            "question": "Malformed question with only 3 options",
            "options": ["Opt A", "Opt B", "Opt C"],  # Malformed: < 4 options
            "correct_index": 0,
        },
        model="gemini",
        source_version_id=s_ver.id,
        source_sha256="h4",
        verification={},
    )
    session.add_all([av1, av2, av3])
    session.flush()
    a1.current_version_id = av1.id
    a2.current_version_id = av2.id
    a3.current_version_id = av3.id
    session.commit()

    # Run guardrails
    flags = run_unit_guardrails(unit.id, session)
    flag_codes = [f.code for f in flags]

    assert "answer_leakage" in flag_codes
    assert "duplicate_question" in flag_codes
    assert "malformed_key" in flag_codes
    assert "missing_objective_coverage" in flag_codes  # Obj 2 has 0 slots

    # Check health calculation
    health = calculate_pack_health(unit.id, session)
    assert health["health_score"] < 70
    assert health["duplicate_count"] >= 1
    session.close()


def test_student_endpoint_strips_keys_and_respects_published_status():
    session = SessionLocal()
    src = Source(title="Doc", filename="doc.txt")
    session.add(src)
    session.flush()

    s_ver = SourceVersion(source_id=src.id, version_no=1, text="Text", sha256="h5")
    session.add(s_ver)
    session.flush()

    unit = Unit(title="Published Unit", source_id=src.id, pinned_source_version_id=s_ver.id)
    session.add(unit)
    session.flush()

    obj = Objective(unit_id=unit.id, position=1, text="Obj", supported=True)
    session.add(obj)
    session.flush()

    s_app = Slot(unit_id=unit.id, objective_id=obj.id, type="quiz_item", position=1)
    s_draft = Slot(unit_id=unit.id, objective_id=obj.id, type="explanation", position=2)
    session.add_all([s_app, s_draft])
    session.flush()

    # Asset 1 is approved
    a_app = Asset(slot_id=s_app.id, status="approved", locked=True)
    # Asset 2 is draft (not approved)
    a_draft = Asset(slot_id=s_draft.id, status="draft", locked=False)
    session.add_all([a_app, a_draft])
    session.flush()

    av_app = AssetVersion(
        asset_id=a_app.id,
        version_no=1,
        content={
            "question": "Sample Question",
            "options": ["A", "B", "C", "D"],
            "correct_index": 2,
            "rationale": "Secret rationale",
            "quote": "Secret quote",
        },
        model="gemini",
        source_version_id=s_ver.id,
        source_sha256="h5",
        verification={"all_verified": True},
    )
    av_draft = AssetVersion(
        asset_id=a_draft.id,
        version_no=1,
        content={"title": "Draft Explanation"},
        model="gemini",
        source_version_id=s_ver.id,
        source_sha256="h5",
        verification={"all_verified": True},
    )
    session.add_all([av_app, av_draft])
    session.flush()
    a_app.current_version_id = av_app.id
    a_draft.current_version_id = av_draft.id
    session.commit()

    unit_id = unit.id
    session.close()

    # 1. Un-published unit => student cannot access (403 Forbidden)
    res_unpub = client.get(f"/api/student/units/{unit_id}", headers={"X-Role": "student", "X-Student-Id": "1"})
    assert res_unpub.status_code == 403

    # 2. Teacher publishes unit
    res_pub = client.post(
        f"/api/units/{unit_id}/publish",
        json={"class_label": "Class 101"},
        headers={"X-Role": "teacher"},
    )
    assert res_pub.status_code == 200

    # 3. Student accesses published unit: ONLY approved asset returned; correct_index, rationale, quote STRIPPED!
    res_stud = client.get(f"/api/student/units/{unit_id}", headers={"X-Role": "student", "X-Student-Id": "1"})
    assert res_stud.status_code == 200
    stud_data = res_stud.json()
    assert len(stud_data["slots"]) == 1  # Only approved slot returned

    q_content = stud_data["slots"][0]["content"]
    assert "question" in q_content
    assert "options" in q_content
    assert "correct_index" not in q_content  # Never leaked
    assert "rationale" not in q_content  # Never leaked
    assert "quote" not in q_content  # Never leaked


def test_change_impact_engine_categorization():
    session = SessionLocal()
    src = Source(title="Doc", filename="doc.txt")
    session.add(src)
    session.flush()

    s_ver = SourceVersion(source_id=src.id, version_no=1, text="Text", sha256="h6")
    session.add(s_ver)
    session.flush()

    unit = Unit(title="Impact Unit", source_id=src.id, pinned_source_version_id=s_ver.id, difficulty="medium")
    session.add(unit)
    session.flush()

    obj = Objective(unit_id=unit.id, position=1, text="Obj", supported=True)
    session.add(obj)
    session.flush()

    s_exp = Slot(unit_id=unit.id, objective_id=obj.id, type="explanation", position=1)
    s_quiz = Slot(unit_id=unit.id, objective_id=obj.id, type="quiz_item", position=2)
    session.add_all([s_exp, s_quiz])
    session.flush()

    a_exp = Asset(slot_id=s_exp.id, status="draft")
    a_quiz = Asset(slot_id=s_quiz.id, status="draft")
    session.add_all([a_exp, a_quiz])
    session.commit()

    # Difficulty change: medium -> advanced
    impact = analyze_change_impact(unit.id, "difficulty:medium->advanced", session)
    assert impact["affected_count"] == 1
    assert impact["unaffected_count"] == 1
    assert impact["affected_slots"][0]["type"] == "quiz_item"
    assert impact["unaffected_slots"][0]["type"] == "explanation"
    session.close()
