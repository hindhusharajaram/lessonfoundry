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


def test_student_quiz_results_and_learning_gap_analytics():
    session = SessionLocal()
    src = Source(title="Photosynthesis", filename="photo.txt")
    session.add(src)
    session.flush()

    s_ver = SourceVersion(source_id=src.id, version_no=1, text="Chloroplasts absorb photons and produce ATP.", sha256="h7")
    session.add(s_ver)
    session.flush()

    chunk = SourceChunk(source_version_id=s_ver.id, idx=0, char_start=0, char_end=len(s_ver.text), text=s_ver.text)
    session.add(chunk)
    session.flush()

    unit = Unit(title="Test Unit", source_id=src.id, pinned_source_version_id=s_ver.id, status="published")
    session.add(unit)
    session.flush()

    obj1 = Objective(unit_id=unit.id, position=1, text="Objective 1", supported=True)
    obj2 = Objective(unit_id=unit.id, position=2, text="Objective 2", supported=True)
    session.add_all([obj1, obj2])
    session.flush()

    slot1 = Slot(unit_id=unit.id, objective_id=obj1.id, type="quiz_item", position=1, difficulty="medium", bloom_tag="Understand")
    slot2 = Slot(unit_id=unit.id, objective_id=obj2.id, type="quiz_item", position=2, difficulty="advanced", bloom_tag="Analyze")
    session.add_all([slot1, slot2])
    session.flush()

    a1 = Asset(slot_id=slot1.id, status="approved", locked=True)
    a2 = Asset(slot_id=slot2.id, status="approved", locked=True)
    session.add_all([a1, a2])
    session.flush()

    v1 = AssetVersion(
        asset_id=a1.id,
        version_no=1,
        variant="standard",
        content={"question": "What is ATP?", "options": ["Energy", "Water", "Gas", "Rock"], "correct_index": 0, "rationale": "ATP stores chemical energy", "quote": "produce ATP."},
        model="gemini",
        prompt_version="1.0",
        settings={},
        source_version_id=s_ver.id,
        source_sha256="h7",
    )
    v2 = AssetVersion(
        asset_id=a2.id,
        version_no=1,
        variant="standard",
        content={"question": "Where does photolysis occur?", "options": ["Stroma", "Thylakoid", "Cytoplasm", "Matrix"], "correct_index": 1, "rationale": "Occurs in thylakoid", "quote": "Chloroplasts absorb photons"},
        model="gemini",
        prompt_version="1.0",
        settings={},
        source_version_id=s_ver.id,
        source_sha256="h7",
    )
    session.add_all([v1, v2])
    session.flush()

    a1.current_version_id = v1.id
    a2.current_version_id = v2.id

    pub = Publication(unit_id=unit.id, class_label="Class 10-A", snapshot={"approved_assets_count": 2, "assets": []})
    session.add(pub)

    # Add a synthetic student
    st = Student(name="Test Student", class_label="Class 10-A", synthetic=True)
    session.add(st)
    session.commit()

    # 1. Student takes quiz: answer Q1 correctly (0), Q2 incorrectly (0 instead of 1)
    res_submit = client.post(
        "/api/student/attempts",
        json={
            "unit_id": unit.id,
            "answers": [
                {"asset_id": a1.id, "chosen_index": 0, "time_seconds": 25},
                {"asset_id": a2.id, "chosen_index": 0, "time_seconds": 40},
            ],
        },
        headers={"X-Role": "student", "X-Student-Id": str(st.id)},
    )
    assert res_submit.status_code == 201
    attempt_id = res_submit.json()["attempt_id"]
    assert res_submit.json()["score"] == 50.0

    # 2. Post-submission results reveal rationales and quotes
    res_results = client.get(
        f"/api/student/attempts/{attempt_id}/results",
        headers={"X-Role": "student"},
    )
    assert res_results.status_code == 200
    res_data = res_results.json()
    assert len(res_data["results"]) == 2
    assert res_data["results"][0]["correct"] is True
    assert res_data["results"][0]["rationale"] == "ATP stores chemical energy"
    assert res_data["results"][1]["correct"] is False

    # 3. Teacher checks analytics => gap detected on Objective 2
    res_analytics = client.get(
        f"/api/units/{unit.id}/analytics",
        headers={"X-Role": "teacher"},
    )
    assert res_analytics.status_code == 200
    analytics_data = res_analytics.json()
    assert analytics_data["total_students"] >= 1
    assert analytics_data["has_synthetic_data"] is True
    assert analytics_data["potential_learning_gap_detected"] is True
    assert analytics_data["gap_summary"]["recommended_objective_id"] == obj2.id

    session.close()


def test_difficulty_change_affects_practice_not_revision():
    """
    Test confirming GET /api/units/{id}/impact with a difficulty change correctly marks
    practice items (practice_foundation, practice_advanced, quiz_item) as affected
    and revision summary/explanation as unaffected with clear reason strings.
    """
    session = SessionLocal()
    src = Source(title="Cellular Biology", filename="cells.txt")
    session.add(src)
    session.flush()

    s_ver = SourceVersion(
        source_id=src.id,
        version_no=1,
        text="Mitochondria produce ATP via cellular respiration.",
        sha256="hash_cells_123",
    )
    session.add(s_ver)
    session.flush()

    unit = Unit(
        title="Cellular Energetics",
        source_id=src.id,
        pinned_source_version_id=s_ver.id,
        difficulty="medium",
        target_grade="High School",
    )
    session.add(unit)
    session.flush()

    obj = Objective(unit_id=unit.id, position=1, text="Understand ATP production", supported=True)
    session.add(obj)
    session.flush()

    # Create 5 slots of distinct pedagogical types
    slot_exp = Slot(unit_id=unit.id, objective_id=obj.id, type="explanation", position=1)
    slot_pf = Slot(unit_id=unit.id, objective_id=obj.id, type="practice_foundation", position=2)
    slot_pa = Slot(unit_id=unit.id, objective_id=obj.id, type="practice_advanced", position=3)
    slot_quiz = Slot(unit_id=unit.id, objective_id=obj.id, type="quiz_item", position=4)
    slot_rev = Slot(unit_id=unit.id, objective_id=obj.id, type="revision", position=5)
    session.add_all([slot_exp, slot_pf, slot_pa, slot_quiz, slot_rev])
    session.flush()

    # Create assets for all slots
    a_exp = Asset(slot_id=slot_exp.id, status="draft")
    a_pf = Asset(slot_id=slot_pf.id, status="draft")
    a_pa = Asset(slot_id=slot_pa.id, status="draft")
    a_quiz = Asset(slot_id=slot_quiz.id, status="draft")
    a_rev = Asset(slot_id=slot_rev.id, status="draft")
    session.add_all([a_exp, a_pf, a_pa, a_quiz, a_rev])
    session.flush()

    # Create asset versions with readable content titles
    av_exp = AssetVersion(asset_id=a_exp.id, version_no=1, content={"title": "Mitochondria Overview"}, model="gemini", source_sha256="hash_cells_123")
    av_pf = AssetVersion(asset_id=a_pf.id, version_no=1, content={"title": "Foundation ATP Practice"}, model="gemini", source_sha256="hash_cells_123")
    av_pa = AssetVersion(asset_id=a_pa.id, version_no=1, content={"title": "Advanced Cellular Analysis"}, model="gemini", source_sha256="hash_cells_123")
    av_quiz = AssetVersion(asset_id=a_quiz.id, version_no=1, content={"question": "Where is ATP synthesized?"}, model="gemini", source_sha256="hash_cells_123")
    av_rev = AssetVersion(asset_id=a_rev.id, version_no=1, content={"summary": "Key Takeaways on ATP"}, model="gemini", source_sha256="hash_cells_123")
    session.add_all([av_exp, av_pf, av_pa, av_quiz, av_rev])
    session.flush()

    a_exp.current_version_id = av_exp.id
    a_pf.current_version_id = av_pf.id
    a_pa.current_version_id = av_pa.id
    a_quiz.current_version_id = av_quiz.id
    a_rev.current_version_id = av_rev.id
    session.commit()

    unit_id = unit.id
    session.close()

    # Hit the GET /api/units/{id}/impact endpoint
    response = client.get(
        f"/api/units/{unit_id}/impact?change=difficulty:medium->advanced",
        headers={"X-Role": "teacher"},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["unit_id"] == unit_id
    assert data["change_descriptor"] == "difficulty:medium->advanced"
    assert data["total_slots"] == 5
    assert data["affected_count"] == 3
    assert data["unaffected_count"] == 2

    affected_types = {item["type"] for item in data["affected_slots"]}
    unaffected_types = {item["type"] for item in data["unaffected_slots"]}

    # Rule Verification:
    # Practice items and quiz items MUST be affected
    assert "practice_foundation" in affected_types
    assert "practice_advanced" in affected_types
    assert "quiz_item" in affected_types

    # Revision summary and conceptual explanation MUST be unaffected
    assert "revision" in unaffected_types
    assert "explanation" in unaffected_types

    # Ensure each item has a descriptive name and non-empty reason string
    for item in data["affected_slots"]:
        assert len(item["name"]) > 0
        assert len(item["reason"]) > 0
        assert "difficulty" in item["reason"].lower()

    for item in data["unaffected_slots"]:
        assert len(item["name"]) > 0
        assert len(item["reason"]) > 0


def test_full_teacher_to_student_workflow_with_real_pdf():
    """
    End-to-end integration test:
    1. Upload real PDF textbook excerpt.
    2. Create unit & plan objectives -> verify at least 5 formative quiz slots created.
    3. Generate/populate learning pack assets.
    4. Teacher review & approval.
    5. Unit publication to student portal.
    6. Student takes quiz with stripped keys.
    7. Automated server-side grading and post-submission results with rationale.
    """
    import fitz

    # 1. Create in-memory PDF
    doc = fitz.open()
    page1 = doc.new_page(width=600, height=400)
    page1.insert_text(
        (50, 50),
        "Photosynthesis is the process by which green plants and certain other organisms transform light energy into chemical energy. "
        "During photosynthesis in green plants, light energy is captured and used to convert water, carbon dioxide, and minerals into oxygen and energy-rich organic compounds. "
        "The light-dependent reactions take place on the thylakoid membranes of chloroplasts, producing ATP and NADPH. "
        "The Calvin cycle takes place in the stroma of chloroplasts, where the enzyme RuBisCO fixes carbon dioxide to synthesize glucose molecules."
    )
    pdf_bytes = doc.tobytes()
    doc.close()

    # Step 1: Upload Source PDF
    files = {"file": ("photosynthesis_curriculum.pdf", pdf_bytes, "application/pdf")}
    upload_resp = client.post(
        "/api/sources/upload",
        data={"title": "Photosynthesis Standard Curriculum"},
        files=files,
        headers={"X-Role": "teacher"},
    )
    assert upload_resp.status_code == 201
    source_id = upload_resp.json()["source_id"]
    source_ver_id = upload_resp.json()["source_version_id"]

    # Step 2: Create Unit (Formative Quiz default = 5)
    create_unit_resp = client.post(
        "/api/units",
        json={
            "title": "Photosynthesis Fundamentals",
            "source_id": source_id,
            "target_grade": "Grade 10 Biology",
            "difficulty": "medium",
            "quiz_count": 5,
        },
        headers={"X-Role": "teacher"},
    )
    assert create_unit_resp.status_code == 201
    unit_id = create_unit_resp.json()["unit_id"]

    # Step 3: Put Objectives
    obj_resp = client.put(
        f"/api/units/{unit_id}/objectives",
        json={
            "objectives": [
                {"text": "Explain light-dependent reactions on thylakoid membranes producing ATP and NADPH.", "bloom_target": "understand"},
                {"text": "Analyze the Calvin cycle in chloroplast stroma with RuBisCO carbon fixation.", "bloom_target": "analyze"},
            ]
        },
        headers={"X-Role": "teacher"},
    )
    assert obj_resp.status_code == 200

    # Step 4: Plan Unit Blueprint
    plan_resp = client.post(
        f"/api/units/{unit_id}/plan",
        headers={"X-Role": "teacher"},
    )
    assert plan_resp.status_code == 200
    plan_data = plan_resp.json()
    quiz_slots = [s for s in plan_data["blueprint"] if s["type"] == "quiz_item"]

    # Invariant A: Formative quiz MUST contain at least 5 questions
    assert len(quiz_slots) >= 5, f"Expected >= 5 quiz slots, got {len(quiz_slots)}"

    # Step 5: Populate and approve all assets
    session = SessionLocal()
    slots = session.query(Slot).filter(Slot.unit_id == unit_id).all()
    approved_asset_ids = []

    for s in slots:
        asset = s.asset
        if not asset:
            asset = Asset(slot_id=s.id)
            session.add(asset)
            session.flush()
        asset.status = "approved"
        asset.locked = True

        if s.type == "quiz_item":
            content = {
                "question": f"Question for slot {s.position}: Where does the light reaction take place?",
                "options": ["Thylakoid membranes", "Stroma", "Outer membrane", "Cytoplasm"],
                "correct_index": 0,
                "rationale": "Light-dependent reactions occur directly across the thylakoid membranes.",
                "quote": "The light-dependent reactions take place on the thylakoid membranes of chloroplasts",
                "bloom": s.bloom_tag,
                "difficulty": s.difficulty,
            }
        elif s.type == "explanation":
            content = {
                "title": "Photosynthesis Mechanism",
                "summary": "Photosynthesis converts light into chemical energy.",
                "sentences": [
                    {"text": "Light energy is captured in chloroplasts.", "quote": "Photosynthesis is the process by which green plants"}
                ],
                "glossary": [
                    {"term": "Thylakoid", "definition": "Membrane sac where light reaction occurs.", "quote": "thylakoid membranes of chloroplasts"}
                ],
            }
        else:
            content = {"title": f"Asset {s.position}", "summary": "Pedagogical content"}

        av = AssetVersion(
            asset_id=asset.id,
            version_no=1,
            content=content,
            model="gemini-2.5-flash",
            source_version_id=source_ver_id,
            source_sha256=upload_resp.json()["sha256"],
            verification={"all_verified": True},
        )
        session.add(av)
        session.flush()
        asset.current_version_id = av.id
        approved_asset_ids.append(asset.id)

    session.commit()
    session.close()

    # Step 6: Publish Unit
    publish_resp = client.post(
        f"/api/units/{unit_id}/publish",
        json={"class_label": "Biology Period 3", "notes": "End of chapter quiz"},
        headers={"X-Role": "teacher"},
    )
    assert publish_resp.status_code == 200
    assert publish_resp.json()["status"] == "published"

    # Step 7: Student accesses published units
    student_units_resp = client.get("/api/student/units", headers={"X-Role": "student"})
    assert student_units_resp.status_code == 200
    published_unit_ids = [u["unit_id"] for u in student_units_resp.json()["units"]]
    assert unit_id in published_unit_ids

    # Step 8: Student fetches unit content -> Verify Answer Keys are STRIPPED
    student_pack_resp = client.get(f"/api/student/units/{unit_id}", headers={"X-Role": "student"})
    assert student_pack_resp.status_code == 200
    student_slots = student_pack_resp.json()["slots"]
    student_quiz_items = [s for s in student_slots if s["type"] == "quiz_item"]
    assert len(student_quiz_items) >= 5

    for q in student_quiz_items:
        # Invariant D: Correct answer and rationale must NOT be exposed before submission
        assert "correct_index" not in q["content"]
        assert "rationale" not in q["content"]
        assert "quote" not in q["content"]
        assert len(q["content"]["options"]) == 4

    # Step 9: Student submits answers
    submission_answers = [
        {"asset_id": q["asset_id"], "chosen_index": 0, "time_seconds": 15}
        for q in student_quiz_items
    ]
    submit_resp = client.post(
        "/api/student/attempts",
        json={"unit_id": unit_id, "answers": submission_answers},
        headers={"X-Role": "student"},
    )
    assert submit_resp.status_code == 201
    submit_data = submit_resp.json()
    assert submit_data["score"] == 100.0
    assert submit_data["correct_count"] == len(student_quiz_items)
    attempt_id = submit_data["attempt_id"]

    # Step 10: Student retrieves post-submission results with explanations
    results_resp = client.get(f"/api/student/attempts/{attempt_id}/results", headers={"X-Role": "student"})
    assert results_resp.status_code == 200
    results_data = results_resp.json()
    assert len(results_data["results"]) == len(student_quiz_items)
    for res in results_data["results"]:
        assert res["correct"] is True
        assert len(res["rationale"]) > 0
        assert len(res["supporting_quote"]) > 0


def test_guardrail_detects_semantic_and_cross_objective_duplicates():
    """Verify that guardrails catch duplicate or near-duplicate questions across objectives."""
    session = SessionLocal()
    src = Source(title="OS Concepts", filename="os.txt")
    session.add(src)
    session.flush()

    s_ver = SourceVersion(
        source_id=src.id,
        version_no=1,
        text="CPU scheduling is the basis of multiprogrammed operating systems. FCFS is non-preemptive.",
        sha256="os_hash_1",
    )
    session.add(s_ver)
    session.flush()

    unit = Unit(title="Operating Systems Unit", source_id=src.id, pinned_source_version_id=s_ver.id)
    session.add(unit)
    session.flush()

    obj1 = Objective(unit_id=unit.id, position=1, text="Explain CPU scheduling and its purpose.", supported=True)
    obj2 = Objective(unit_id=unit.id, position=2, text="Calculate waiting time using FCFS.", supported=True)
    session.add_all([obj1, obj2])
    session.flush()

    # Slot 1: Quiz item on Obj 1
    slot1 = Slot(unit_id=unit.id, objective_id=obj1.id, type="quiz_item", position=1)
    # Slot 2: Quiz item on Obj 2 with semantically identical question (rephrased)
    slot2 = Slot(unit_id=unit.id, objective_id=obj2.id, type="quiz_item", position=2)
    session.add_all([slot1, slot2])
    session.flush()

    asset1 = Asset(slot_id=slot1.id, status="draft")
    asset2 = Asset(slot_id=slot2.id, status="draft")
    session.add_all([asset1, asset2])
    session.flush()

    # Asset 1 Question
    av1 = AssetVersion(
        asset_id=asset1.id,
        version_no=1,
        content={
            "question": "What is the primary purpose of CPU scheduling in multiprogrammed operating systems?",
            "options": ["Maximize CPU utilization", "Increase disk space", "Format partitions", "Cool the CPU"],
            "correct_index": 0,
            "rationale": "CPU scheduling aims to maximize CPU utilization.",
            "quote": "CPU scheduling is the basis of multiprogrammed operating systems.",
        },
        model="gemini-2.5-flash",
        source_version_id=s_ver.id,
        source_sha256=s_ver.sha256,
        verification={"all_verified": True},
    )
    # Asset 2 Question: Semantically near-identical question (should be caught by token_set / fuzzy ratio)
    av2 = AssetVersion(
        asset_id=asset2.id,
        version_no=1,
        content={
            "question": "What is the main purpose of CPU scheduling in a multiprogrammed operating system?",
            "options": ["Maximize CPU utilization", "Increase memory size", "Manage network cables", "Format disk"],
            "correct_index": 0,
            "rationale": "CPU scheduling maximizes CPU utilization.",
            "quote": "CPU scheduling is the basis of multiprogrammed operating systems.",
        },
        model="gemini-2.5-flash",
        source_version_id=s_ver.id,
        source_sha256=s_ver.sha256,
        verification={"all_verified": True},
    )
    session.add_all([av1, av2])
    session.flush()
    asset1.current_version_id = av1.id
    asset2.current_version_id = av2.id
    session.commit()

    # Run unit guardrails
    flags = run_unit_guardrails(unit.id, session)
    dup_flags = [f for f in flags if f.code == "duplicate_question"]
    assert len(dup_flags) > 0, f"Expected duplicate_question guardrail flag for semantically repeated question, got {[f.code for f in flags]}"
    assert "similar" in dup_flags[0].message.lower() or "duplicate" in dup_flags[0].message.lower()
    session.close()


def test_cpu_scheduling_three_objectives_foundation_vs_advanced_differentiation():
    """Verify distinctness across Objective #1 (Explain CPU scheduling), Objective #2 (Calculate FCFS/SJF), and Objective #3 (Compare algorithms)."""
    session = SessionLocal()
    src = Source(title="OS Textbook", filename="os_text.txt")
    session.add(src)
    session.flush()

    source_text = (
        "CPU scheduling is the process of allocating the CPU to ready processes. "
        "The primary purpose is to make the system efficient, fast, and fair. "
        "In First-Come, First-Served (FCFS), the process that requests the CPU first is allocated first. "
        "Shortest Job First (SJF) associates with each process the length of its next CPU burst. "
        "Waiting time is the total time spent in the ready queue. "
        "Turnaround time is the interval from submission of a process to completion. "
        "Priority scheduling allocates CPU to the process with the highest priority. "
        "Round Robin (RR) is designed for time-sharing systems where each process gets a small unit of CPU time called a time quantum."
    )
    s_ver = SourceVersion(
        source_id=src.id,
        version_no=1,
        text=source_text,
        sha256="os_hash_cpu_sched",
    )
    session.add(s_ver)
    session.flush()

    chunk1 = SourceChunk(
        source_version_id=s_ver.id,
        idx=0,
        text=source_text,
        char_start=0,
        char_end=len(source_text),
    )
    session.add(chunk1)
    session.flush()

    unit = Unit(
        title="CPU Scheduling Unit",
        source_id=src.id,
        pinned_source_version_id=s_ver.id,
        quiz_count=5,
    )
    session.add(unit)
    session.flush()

    obj1 = Objective(unit_id=unit.id, position=1, text="Explain CPU scheduling and its purpose.", supported=True)
    obj2 = Objective(unit_id=unit.id, position=2, text="Calculate waiting time and turnaround time using FCFS and SJF.", supported=True)
    obj3 = Objective(unit_id=unit.id, position=3, text="Compare FCFS, SJF, Priority Scheduling, and Round Robin.", supported=True)
    session.add_all([obj1, obj2, obj3])
    session.flush()

    # Create distinct slots for each objective
    # Obj 1: Foundation Practice (basic purpose / concept)
    slot_obj1_found = Slot(unit_id=unit.id, objective_id=obj1.id, type="practice_foundation", position=1, difficulty="easy", bloom_tag="Understand")
    # Obj 2: Advanced Practice (calculating waiting/turnaround time)
    slot_obj2_adv = Slot(unit_id=unit.id, objective_id=obj2.id, type="practice_advanced", position=2, difficulty="advanced", bloom_tag="Analyze")
    # Obj 3: Quiz Item (comparative analysis)
    slot_obj3_quiz = Slot(unit_id=unit.id, objective_id=obj3.id, type="quiz_item", position=3, difficulty="medium", bloom_tag="Analyze")
    session.add_all([slot_obj1_found, slot_obj2_adv, slot_obj3_quiz])
    session.flush()

    asset1 = Asset(slot_id=slot_obj1_found.id, status="draft")
    asset2 = Asset(slot_id=slot_obj2_adv.id, status="draft")
    asset3 = Asset(slot_id=slot_obj3_quiz.id, status="draft")
    session.add_all([asset1, asset2, asset3])
    session.flush()

    # Foundation practice: Direct definition/purpose
    av1 = AssetVersion(
        asset_id=asset1.id,
        version_no=1,
        content={
            "question": "What is the primary purpose of CPU scheduling?",
            "options": ["To allocate CPU time efficiently to ready processes", "To increase hard drive storage capacity", "To prevent thermal throttling", "To compile source code"],
            "correct_index": 0,
            "rationale": "CPU scheduling allocates the CPU to ready processes to keep the system efficient and fair.",
            "quote": "CPU scheduling is the process of allocating the CPU to ready processes.",
            "bloom": "Understand",
            "difficulty": "easy",
        },
        model="gemini-2.5-flash",
        source_version_id=s_ver.id,
        source_sha256=s_ver.sha256,
        verification={"all_verified": True},
    )

    # Advanced practice: Multi-step calculation / reasoning
    av2 = AssetVersion(
        asset_id=asset2.id,
        version_no=1,
        content={
            "question": "How is turnaround time differentiated from waiting time when analyzing FCFS and SJF execution?",
            "options": [
                "Turnaround time is submission to completion; waiting time is total time spent in ready queue",
                "Turnaround time only measures CPU burst; waiting time includes I/O completion",
                "Turnaround time is always less than waiting time in SJF",
                "Waiting time includes context switch overhead while turnaround time does not",
            ],
            "correct_index": 0,
            "rationale": "Turnaround time spans the entire interval from submission to completion, whereas waiting time measures only queue duration.",
            "quote": "Turnaround time is the interval from submission of a process to completion.",
            "bloom": "Analyze",
            "difficulty": "advanced",
        },
        model="gemini-2.5-flash",
        source_version_id=s_ver.id,
        source_sha256=s_ver.sha256,
        verification={"all_verified": True},
    )

    # Quiz item: Comparative trade-offs
    av3 = AssetVersion(
        asset_id=asset3.id,
        version_no=1,
        content={
            "question": "Which scheduling algorithm specifically uses time slices (quanta) to prevent starvation in time-sharing systems?",
            "options": ["Round Robin (RR)", "First-Come, First-Served (FCFS)", "Shortest Job First (SJF)", "Static Priority Scheduling"],
            "correct_index": 0,
            "rationale": "Round Robin assigns a small time quantum to each process specifically for time-sharing systems.",
            "quote": "Round Robin (RR) is designed for time-sharing systems where each process gets a small unit of CPU time called a time quantum.",
            "bloom": "Analyze",
            "difficulty": "medium",
        },
        model="gemini-2.5-flash",
        source_version_id=s_ver.id,
        source_sha256=s_ver.sha256,
        verification={"all_verified": True},
    )

    session.add_all([av1, av2, av3])
    session.flush()
    asset1.current_version_id = av1.id
    asset2.current_version_id = av2.id
    asset3.current_version_id = av3.id
    session.commit()

    # Verify no duplicate flags raised among these 3 distinct items
    flags = run_unit_guardrails(unit.id, session)
    dup_flags = [f for f in flags if f.code == "duplicate_question"]
    assert len(dup_flags) == 0, f"Unexpected duplicate flags: {[f.message for f in dup_flags]}"

    # Verify distinct cognitive levels
    assert av1.content["difficulty"] == "easy"
    assert av2.content["difficulty"] == "advanced"
    assert av1.content["question"] != av2.content["question"]
    assert av2.content["question"] != av3.content["question"]
    assert av1.content["question"] != av3.content["question"]
    session.close()


def test_two_submitted_objectives_produce_slots_only_for_objective_1_and_2():
    """Verify that submitting 2 objectives produces blueprint slots strictly for Objective #1 and #2."""
    session = SessionLocal()
    src = Source(title="Biology Textbook", filename="bio.txt")
    session.add(src)
    session.flush()

    source_text = (
        "Cellular respiration converts glucose into ATP. "
        "Glycolysis occurs in the cytoplasm and produces 2 pyruvate molecules. "
        "The Krebs cycle occurs in mitochondrial matrix producing NADH and FADH2. "
        "Oxidative phosphorylation generates the bulk of cellular ATP."
    )
    s_ver = SourceVersion(
        source_id=src.id,
        version_no=1,
        text=source_text,
        sha256="bio_hash_respiration",
    )
    session.add(s_ver)
    session.flush()

    chunk1 = SourceChunk(
        source_version_id=s_ver.id,
        idx=0,
        text=source_text,
        char_start=0,
        char_end=len(source_text),
    )
    session.add(chunk1)
    session.flush()

    unit = Unit(title="Respiration Unit", source_id=src.id, pinned_source_version_id=s_ver.id, quiz_count=5)
    session.add(unit)
    session.flush()

    obj1 = Objective(unit_id=unit.id, position=1, text="Explain glycolysis mechanism and products.", supported=True)
    obj2 = Objective(unit_id=unit.id, position=2, text="Analyze oxidative phosphorylation and ATP yield.", supported=True)
    session.add_all([obj1, obj2])
    session.commit()

    # Plan the unit
    plan_resp = client.post(f"/api/units/{unit.id}/plan", headers={"X-Role": "teacher"})
    assert plan_resp.status_code == 200
    plan_data = plan_resp.json()

    assert plan_data["total_objectives"] == 2
    assert plan_data["supported_objectives_count"] == 2

    # Every slot must reference ONLY obj1.id or obj2.id
    valid_ids = {obj1.id, obj2.id}
    for slot in plan_data["blueprint"]:
        assert slot["objective_id"] in valid_ids, f"Slot referenced unexpected objective ID: {slot['objective_id']}"
        assert slot["objective_position"] in {1, 2}, f"Slot referenced unexpected position: {slot['objective_position']}"
        assert slot["objective_text"] in {obj1.text, obj2.text}


def test_three_submitted_objectives_produce_slots_only_for_objectives_1_2_and_3():
    """Verify that submitting 3 objectives produces blueprint slots strictly for Objective #1, #2, and #3."""
    session = SessionLocal()
    src = Source(title="Chemistry Book", filename="chem.txt")
    session.add(src)
    session.flush()

    source_text = (
        "Acids donate protons in aqueous solution. "
        "Bases accept protons and have pH greater than 7. "
        "Buffer solutions resist changes in pH upon addition of small amounts of acid or base."
    )
    s_ver = SourceVersion(source_id=src.id, version_no=1, text=source_text, sha256="chem_hash")
    session.add(s_ver)
    session.flush()

    chunk1 = SourceChunk(source_version_id=s_ver.id, idx=0, text=source_text, char_start=0, char_end=len(source_text))
    session.add(chunk1)
    session.flush()

    unit = Unit(title="Acid Base Unit", source_id=src.id, pinned_source_version_id=s_ver.id, quiz_count=6)
    session.add(unit)
    session.flush()

    obj1 = Objective(unit_id=unit.id, position=1, text="Define Bronsted-Lowry acids.", supported=True)
    obj2 = Objective(unit_id=unit.id, position=2, text="Define Bronsted-Lowry bases.", supported=True)
    obj3 = Objective(unit_id=unit.id, position=3, text="Explain buffer mechanism resisting pH change.", supported=True)
    session.add_all([obj1, obj2, obj3])
    session.commit()

    plan_resp = client.post(f"/api/units/{unit.id}/plan", headers={"X-Role": "teacher"})
    assert plan_resp.status_code == 200
    plan_data = plan_resp.json()

    assert plan_data["total_objectives"] == 3
    assert plan_data["supported_objectives_count"] == 3

    valid_ids = {obj1.id, obj2.id, obj3.id}
    for slot in plan_data["blueprint"]:
        assert slot["objective_id"] in valid_ids
        assert slot["objective_position"] in {1, 2, 3}


def test_new_unit_cannot_inherit_objectives_from_previous_unit():
    """Verify complete isolation between units: Unit B never inherits or references Unit A's objectives."""
    session = SessionLocal()
    src = Source(title="Multi Unit Source", filename="multi.txt")
    session.add(src)
    session.flush()

    text = "Physics mechanics covers forces, acceleration, and Newton laws. Optics covers reflection and refraction."
    s_ver = SourceVersion(source_id=src.id, version_no=1, text=text, sha256="physics_multi")
    session.add(s_ver)
    session.flush()

    chunk = SourceChunk(source_version_id=s_ver.id, idx=0, text=text, char_start=0, char_end=len(text))
    session.add(chunk)
    session.flush()

    # Unit 1 (Mechanics) with 2 objectives
    unit1 = Unit(title="Unit 1 Mechanics", source_id=src.id, pinned_source_version_id=s_ver.id)
    session.add(unit1)
    session.flush()
    u1_obj1 = Objective(unit_id=unit1.id, position=1, text="Explain Newton's first law of motion.", supported=True)
    u1_obj2 = Objective(unit_id=unit1.id, position=2, text="Calculate acceleration using F=ma.", supported=True)
    session.add_all([u1_obj1, u1_obj2])
    session.commit()

    client.post(f"/api/units/{unit1.id}/plan", headers={"X-Role": "teacher"})

    # Unit 2 (Optics) with 2 completely different objectives
    unit2 = Unit(title="Unit 2 Optics", source_id=src.id, pinned_source_version_id=s_ver.id)
    session.add(unit2)
    session.flush()
    u2_obj1 = Objective(unit_id=unit2.id, position=1, text="Explain the law of reflection.", supported=True)
    u2_obj2 = Objective(unit_id=unit2.id, position=2, text="Calculate refraction angle using Snell's Law.", supported=True)
    session.add_all([u2_obj1, u2_obj2])
    session.commit()

    plan2_resp = client.post(f"/api/units/{unit2.id}/plan", headers={"X-Role": "teacher"})
    assert plan2_resp.status_code == 200
    plan2_data = plan2_resp.json()

    # Unit 2 blueprint MUST ONLY contain Unit 2's objective IDs (never Unit 1's IDs)
    u2_valid_ids = {u2_obj1.id, u2_obj2.id}
    u1_ids = {u1_obj1.id, u1_obj2.id}

    assert not u2_valid_ids.intersection(u1_ids), "Objective IDs between separate units must be distinct"

    for slot in plan2_data["blueprint"]:
        assert slot["objective_id"] in u2_valid_ids
        assert slot["objective_id"] not in u1_ids


def test_editing_objective_count_updates_blueprint_and_clears_stale_slots():
    """Verify that PUT /api/units/{id}/objectives clears old blueprint slots and creates a clean plan."""
    session = SessionLocal()
    src = Source(title="Economics", filename="econ.txt")
    session.add(src)
    session.flush()

    text = "Microeconomics studies supply, demand, and market equilibrium. Macroeconomics studies GDP and inflation."
    s_ver = SourceVersion(source_id=src.id, version_no=1, text=text, sha256="econ_hash")
    session.add(s_ver)
    session.flush()

    chunk = SourceChunk(source_version_id=s_ver.id, idx=0, text=text, char_start=0, char_end=len(text))
    session.add(chunk)
    session.flush()

    unit = Unit(title="Economics Unit", source_id=src.id, pinned_source_version_id=s_ver.id)
    session.add(unit)
    session.commit()

    # Step 1: Initialize with 3 objectives
    put1_resp = client.put(
        f"/api/units/{unit.id}/objectives",
        json={
            "objectives": [
                {"text": "Explain law of supply and demand curve shifts.", "bloom_target": "understand"},
                {"text": "Calculate market equilibrium price and quantity.", "bloom_target": "apply"},
                {"text": "Analyze price elasticity of demand.", "bloom_target": "analyze"},
            ]
        },
        headers={"X-Role": "teacher"},
    )
    assert put1_resp.status_code == 200
    assert put1_resp.json()["objectives_count"] == 3

    plan1 = client.post(f"/api/units/{unit.id}/plan", headers={"X-Role": "teacher"}).json()
    slots_count_3_objs = plan1["slots_count"]

    # Step 2: Edit to exactly 2 objectives (reducing count)
    put2_resp = client.put(
        f"/api/units/{unit.id}/objectives",
        json={
            "objectives": [
                {"text": "Explain law of supply and demand curve shifts.", "bloom_target": "understand"},
                {"text": "Calculate market equilibrium price and quantity.", "bloom_target": "apply"},
            ]
        },
        headers={"X-Role": "teacher"},
    )
    assert put2_resp.status_code == 200
    assert put2_resp.json()["objectives_count"] == 2

    # Step 3: Re-plan with 2 objectives
    plan2 = client.post(f"/api/units/{unit.id}/plan", headers={"X-Role": "teacher"}).json()
    assert plan2["total_objectives"] == 2
    assert plan2["supported_objectives_count"] == 2
    assert plan2["slots_count"] < slots_count_3_objs

    # Check that every slot references only 1 of the 2 new objective IDs
    session = SessionLocal()
    current_objs = session.query(Objective).filter(Objective.unit_id == unit.id).all()
    current_obj_ids = {o.id for o in current_objs}
    assert len(current_obj_ids) == 2

    for slot in plan2["blueprint"]:
        assert slot["objective_id"] in current_obj_ids
        assert slot["objective_position"] in {1, 2}
    session.close()


def test_generator_validates_objective_ownership_and_prevents_foreign_links():
    """Verify that generator strictly enforces objective validation before slot execution."""
    from engine.generator import generate_unit_pack
    session = SessionLocal()
    src = Source(title="Math Book", filename="math.txt")
    session.add(src)
    session.flush()

    text = "Linear algebra covers vectors and matrices. Calculus covers differentiation and integration."
    s_ver = SourceVersion(source_id=src.id, version_no=1, text=text, sha256="math_hash")
    session.add(s_ver)
    session.flush()

    chunk = SourceChunk(source_version_id=s_ver.id, idx=0, text=text, char_start=0, char_end=len(text))
    session.add(chunk)
    session.flush()

    unit_a = Unit(title="Unit A", source_id=src.id, pinned_source_version_id=s_ver.id)
    unit_b = Unit(title="Unit B", source_id=src.id, pinned_source_version_id=s_ver.id)
    session.add_all([unit_a, unit_b])
    session.flush()

    obj_a1 = Objective(unit_id=unit_a.id, position=1, text="Explain vector addition.", supported=True)
    obj_a2 = Objective(unit_id=unit_a.id, position=2, text="Calculate matrix determinant.", supported=True)
    obj_b1 = Objective(unit_id=unit_b.id, position=1, text="Explain derivatives.", supported=True)
    session.add_all([obj_a1, obj_a2, obj_b1])
    session.flush()

    # Create slot on Unit A incorrectly pointing to Unit B's objective
    corrupt_slot = Slot(unit_id=unit_a.id, objective_id=obj_b1.id, type="explanation", position=1)
    session.add(corrupt_slot)
    session.commit()

    # Generator MUST reject this before slot execution
    with pytest.raises(ValueError, match="does not belong to unit"):
        generate_unit_pack(unit_a.id, session)
    session.close()





