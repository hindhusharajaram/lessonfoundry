import json
from unittest.mock import patch
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from db.database import Base
from db.models import (
    Asset,
    AssetVersion,
    Claim,
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
from engine.bloom import get_bloom_target_for_question
from engine.generator import count_explanation_words, generate_slot
from engine.guardrails import calculate_pack_health, run_unit_guardrails
from engine.planner import calculate_difficulty_distribution, plan_unit
from api.routes_student import get_attempt_results, get_student_unit
from api.deps import AuthContext


@pytest.fixture
def db():
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


def create_mock_unit_with_source(db, title="Cell Biology", text=None, quiz_count=10, constraints=None, difficulty="medium"):
    if text is None:
        text = (
            "Mitochondria are double-membrane bound organelles responsible for producing ATP through cellular respiration. "
            "The inner membrane is folded into cristae to increase surface area for electron transport chains. "
            "Glycolysis occurs in the cytoplasm, breaking glucose into pyruvate. "
            "The Krebs cycle operates inside the mitochondrial matrix, producing NADH and FADH2."
        )
    src = Source(title=f"{title} Source", filename="source.txt")
    db.add(src)
    db.flush()

    s_ver = SourceVersion(
        source_id=src.id,
        version_no=1,
        text=text,
        sha256="fake_sha_bio_123",
    )
    db.add(s_ver)
    db.flush()

    chunk1 = SourceChunk(
        source_version_id=s_ver.id,
        idx=0,
        char_start=0,
        char_end=len(text),
        text=text,
    )
    db.add(chunk1)
    db.flush()

    unit = Unit(
        title=title,
        source_id=src.id,
        pinned_source_version_id=s_ver.id,
        target_grade="Grade 11",
        difficulty=difficulty,
        language="English",
        answer_visibility="after_submission",
        quiz_count=quiz_count,
        constraints=constraints or {},
        status="draft",
    )
    db.add(unit)
    db.flush()

    obj1 = Objective(
        unit_id=unit.id,
        position=1,
        text="Explain mitochondrial structure and ATP synthesis through cristae.",
        bloom_target="Understand",
        supported=True,
    )
    obj2 = Objective(
        unit_id=unit.id,
        position=2,
        text="Compare cytoplasmic glycolysis with the mitochondrial Krebs cycle.",
        bloom_target="Analyze",
        supported=True,
    )
    db.add_all([obj1, obj2])
    db.flush()

    return unit, obj1, obj2, s_ver, chunk1


def test_1_explanation_word_limit_enforced(db):
    """TEST 1: Max Words (Explanation) limit is strictly enforced and measured consistently."""
    unit, obj1, obj2, s_ver, chunk1 = create_mock_unit_with_source(
        db, constraints={"max_words": 50}
    )

    # Explanation with 30 words (valid)
    valid_content = {
        "title": "Mitochondria and ATP",
        "summary": "Mitochondria produce cellular ATP energy.",
        "sentences": [
            {
                "text": "The inner membrane is folded into cristae to increase surface area.",
                "quote": "The inner membrane is folded into cristae to increase surface area for electron transport chains.",
            },
            {
                "text": "Mitochondria are double-membrane bound organelles responsible for producing ATP.",
                "quote": "Mitochondria are double-membrane bound organelles responsible for producing ATP through cellular respiration.",
            },
            {
                "text": "Glycolysis breaks glucose into pyruvate.",
                "quote": "Glycolysis occurs in the cytoplasm, breaking glucose into pyruvate.",
            },
        ],
        "glossary": [
            {
                "term": "Cristae",
                "definition": "Inner folds in mitochondria increasing surface area.",
                "quote": "The inner membrane is folded into cristae to increase surface area for electron transport chains.",
            }
        ],
    }

    word_count = count_explanation_words(valid_content)
    assert word_count <= 50, f"Expected <= 50 words, got {word_count}"

    # Verify count_explanation_words handles oversized content
    long_content = dict(valid_content)
    long_content["summary"] = " ".join(["word"] * 60)
    assert count_explanation_words(long_content) > 50


def test_2_quiz_item_count_and_difficulty_distribution(db):
    """TEST 2: Teacher requests 10 quiz items with defined distribution; exactly 10 distinct items are planned."""
    custom_dist = {"easy": 3, "medium": 4, "hard": 3}
    unit, obj1, obj2, s_ver, chunk1 = create_mock_unit_with_source(
        db, quiz_count=10, constraints={"difficulty_distribution": custom_dist}
    )

    with patch("engine.planner.evaluate_objective_gap", return_value=True):
        plan_res = plan_unit(unit, db)

    quiz_slots = db.query(Slot).filter_by(unit_id=unit.id, type="quiz_item").all()
    assert len(quiz_slots) == 10

    # Verify difficulty distribution
    easy_count = sum(1 for s in quiz_slots if s.difficulty == "easy")
    med_count = sum(1 for s in quiz_slots if s.difficulty == "medium")
    hard_count = sum(1 for s in quiz_slots if s.difficulty in ["hard", "advanced"])

    assert easy_count == 3
    assert med_count == 4
    assert hard_count == 3


def test_3_quiz_and_practice_uniqueness_across_objectives(db):
    """TEST 3: Quiz and practice slots are distinct and mapped across objectives."""
    unit, obj1, obj2, s_ver, chunk1 = create_mock_unit_with_source(db, quiz_count=6)

    with patch("engine.planner.evaluate_objective_gap", return_value=True):
        plan_unit(unit, db)

    slots = db.query(Slot).filter_by(unit_id=unit.id).order_by(Slot.position).all()
    
    # 2 explanations + 2 examples + 2 revisions + 6 quiz + 2 foundation + 2 advanced = 16 slots
    assert len(slots) == 16

    obj1_slots = [s for s in slots if s.objective_id == obj1.id]
    obj2_slots = [s for s in slots if s.objective_id == obj2.id]

    assert len(obj1_slots) == 8
    assert len(obj2_slots) == 8


def test_4_foundation_vs_advanced_practice_cognitive_demand(db):
    """TEST 4: Foundation practice is easy/introductory, Advanced practice is analytical/rigorous."""
    unit, obj1, obj2, s_ver, chunk1 = create_mock_unit_with_source(db)

    with patch("engine.planner.evaluate_objective_gap", return_value=True):
        plan_unit(unit, db)

    found_slots = db.query(Slot).filter_by(unit_id=unit.id, type="practice_foundation").all()
    adv_slots = db.query(Slot).filter_by(unit_id=unit.id, type="practice_advanced").all()

    assert len(found_slots) == 2
    assert len(adv_slots) == 2

    for fs in found_slots:
        assert fs.difficulty == "easy"
        assert fs.bloom_tag in ["Remember", "Understand"]

    for aslot in adv_slots:
        assert aslot.difficulty == "advanced"
        assert aslot.bloom_tag in ["Analyze", "Evaluate"]


def test_5_assets_correct_objective_mappings_and_draft_status(db):
    """TEST 5: All slots have non-null objective IDs, correct Bloom levels, and enter draft status."""
    unit, obj1, obj2, s_ver, chunk1 = create_mock_unit_with_source(db)

    with patch("engine.planner.evaluate_objective_gap", return_value=True):
        plan_unit(unit, db)

    all_slots = db.query(Slot).filter_by(unit_id=unit.id).all()
    for s in all_slots:
        assert s.objective_id in [obj1.id, obj2.id]
        assert s.asset is not None
        assert s.asset.status == "draft"
        assert s.bloom_tag is not None


def test_6_pack_health_pending_state_and_accurate_scoring(db):
    """TEST 6: Pack health reflects in_progress and does not claim 100% when no claims are generated yet."""
    unit, obj1, obj2, s_ver, chunk1 = create_mock_unit_with_source(db)

    with patch("engine.planner.evaluate_objective_gap", return_value=True):
        plan_unit(unit, db)

    health = calculate_pack_health(unit.id, db)
    assert health["generation_complete"] is False
    assert health["total_claims"] == 0
    assert health["grounding_percentage"] == 0.0


def test_7_student_visibility_and_answer_key_protection(db):
    """TEST 7: Students cannot access unpublished/draft content or teacher-only answer keys."""
    unit, obj1, obj2, s_ver, chunk1 = create_mock_unit_with_source(db)
    unit.answer_visibility = "teacher_only"
    db.commit()

    # Draft unit without publication cannot be accessed by students
    auth = AuthContext(role="student", student_id=1)
    with pytest.raises(Exception) as exc_info:
        get_student_unit(unit.id, db, auth)
    assert "not been published" in str(exc_info.value.detail)

    # Publish unit with an approved quiz slot
    pub = Publication(
        unit_id=unit.id,
        class_label="Biology 101",
        snapshot={"approved_assets_count": 1},
    )
    db.add(pub)

    slot = Slot(
        unit_id=unit.id,
        objective_id=obj1.id,
        type="quiz_item",
        position=1,
        difficulty="medium",
        bloom_tag="Understand",
    )
    db.add(slot)
    db.flush()

    asset = Asset(slot_id=slot.id, status="approved", locked=True)
    db.add(asset)
    db.flush()

    av = AssetVersion(
        asset_id=asset.id,
        version_no=1,
        content={
            "question": "What organelle produces ATP?",
            "options": ["Mitochondria", "Ribosome", "Nucleus", "Vacuole"],
            "correct_index": 0,
            "rationale": "Mitochondria produce ATP via respiration.",
            "quote": "Mitochondria are double-membrane bound organelles responsible for producing ATP through cellular respiration.",
        },
        model="gemini-2.5-flash",
        prompt_version="1.0",
        settings={},
        source_version_id=s_ver.id,
        source_sha256=s_ver.sha256,
    )
    db.add(av)
    db.flush()
    asset.current_version_id = av.id
    db.commit()

    # 1. Student viewing unit gets stripped quiz options without correct_index or quote
    res = get_student_unit(unit.id, db, auth)
    assert len(res["slots"]) == 1
    student_content = res["slots"][0]["content"]
    assert "correct_index" not in student_content
    assert "rationale" not in student_content
    assert "quote" not in student_content
    assert student_content["question"] == "What organelle produces ATP?"

    # 2. Student attempt results with teacher_only visibility hide correct_index and rationale
    student = Student(id=1, name="Alice", class_label="Biology 101")
    db.add(student)
    db.flush()

    attempt = QuizAttempt(unit_id=unit.id, student_id=student.id)
    db.add(attempt)
    db.flush()
    from db.models import AttemptAnswer
    ans = AttemptAnswer(attempt_id=attempt.id, asset_id=asset.id, chosen_index=0, correct=True)
    db.add(ans)
    db.commit()

    results = get_attempt_results(attempt.id, db, auth)
    assert results["results"][0]["correct"] is True
    assert results["results"][0]["correct_index"] is None
    assert results["results"][0]["rationale"] is None


def test_8_subject_agnostic_rules_apply_to_different_subjects(db):
    """TEST 8: Verified generation rules work seamlessly for Chemistry/History without hardcoded CPU assumptions."""
    chemistry_text = (
        "Covalent bonding occurs when nonmetal atoms share valence electrons to achieve a stable octet. "
        "Methane (CH4) features four single covalent C-H bonds forming a tetrahedral geometry. "
        "Ionic bonds form via electrostatic attraction between oppositely charged cations and anions."
    )
    unit, obj1, obj2, s_ver, chunk1 = create_mock_unit_with_source(
        db, title="Chemical Bonding", text=chemistry_text, quiz_count=8, difficulty="easy"
    )

    with patch("engine.planner.evaluate_objective_gap", return_value=True):
        plan_res = plan_unit(unit, db)

    assert plan_res["status"] == "planned"
    assert plan_res["slots_count"] == 18  # 2 exp + 2 ex + 2 rev + 8 quiz + 2 found + 2 adv = 18 slots
    
    quiz_slots = db.query(Slot).filter_by(unit_id=unit.id, type="quiz_item").all()
    assert len(quiz_slots) == 8
    # Easy unit gives higher percentage of easy items
    easy_count = sum(1 for s in quiz_slots if s.difficulty == "easy")
    assert easy_count >= 4


def test_9_no_placeholder_options_or_objective_as_question(db):
    """TEST 9: Generated questions and options never contain generic placeholder phrases or objective copies."""
    cpu_source = (
        "In First-Come First-Served (FCFS) scheduling, processes are executed in arrival order. "
        "A long CPU-bound process at the front of the ready queue causes the convoy effect, resulting in high average waiting times. "
        "Shortest Job First (SJF) selects the process with the smallest CPU burst. "
        "Shortest Remaining Time First (SRTF) is the preemptive version of SJF. "
        "Priority scheduling may cause starvation for low-priority processes, which is solved by aging. "
        "Round Robin assigns a fixed time quantum to each process in cyclic order."
    )
    unit, obj1, obj2, s_ver, chunk1 = create_mock_unit_with_source(
        db,
        title="CPU Scheduling",
        text=cpu_source,
        quiz_count=6,
    )

    with patch("engine.planner.evaluate_objective_gap", return_value=True):
        plan_unit(unit, db)

    quiz_slots = db.query(Slot).filter_by(unit_id=unit.id, type="quiz_item").all()
    assert len(quiz_slots) == 6

    forbidden_phrases = [
        "contradictory claim",
        "unsupported by the source text",
        "alternative mechanism not described",
        "outdated hypothesis",
        "according to the source text regarding",
    ]

    for slot in quiz_slots:
        av = generate_slot(slot, db)
        content = av.content or {}
        q_text = content.get("question", "")
        options = content.get("options", [])

        # 1. Question must NOT contain forbidden phrases or wrap objective text
        for fp in forbidden_phrases:
            assert fp not in q_text.lower(), f"Question contains forbidden phrase '{fp}': {q_text}"

        assert obj1.text.lower() not in q_text.lower() or len(q_text) > len(obj1.text) + 60
        assert obj2.text.lower() not in q_text.lower() or len(q_text) > len(obj2.text) + 60

        # 2. Options must NOT contain placeholder phrases
        assert len(options) == 4
        for opt in options:
            for fp in forbidden_phrases:
                assert fp not in opt.lower(), f"Option contains forbidden phrase '{fp}': {opt}"
            assert opt.strip().lower() != obj1.text.strip().lower()
            assert opt.strip().lower() != obj2.text.strip().lower()

        # 3. Verified evidence quote must be from the real source text
        assert av.verification.get("all_verified") is True
        assert content.get("quote") in cpu_source


def test_10_guardrail_catches_and_flags_placeholder_content(db):
    """TEST 10: Guardrail engine flags any invalid placeholder content or objective copying."""
    unit, obj1, obj2, s_ver, chunk1 = create_mock_unit_with_source(db)

    slot = Slot(
        unit_id=unit.id,
        objective_id=obj1.id,
        type="quiz_item",
        position=1,
        difficulty="medium",
        bloom_tag="Understand",
    )
    db.add(slot)
    db.flush()

    asset = Asset(slot_id=slot.id, status="draft", locked=False)
    db.add(asset)
    db.flush()

    # Asset with generic placeholder option
    bad_av = AssetVersion(
        asset_id=asset.id,
        version_no=1,
        content={
            "question": "What is the function of mitochondria?",
            "options": [
                "Produces cellular ATP.",
                "Contradictory claim unsupported by the source text regarding mitochondria.",
                "Alternative mechanism not described in the provided source document.",
                "Outdated hypothesis regarding cell energy.",
            ],
            "correct_index": 0,
            "rationale": "Directly supported.",
            "quote": "Mitochondria are double-membrane bound organelles responsible for producing ATP through cellular respiration.",
        },
        model="gemini-2.5-flash",
        prompt_version="1.0",
        settings={},
        source_version_id=s_ver.id,
        source_sha256=s_ver.sha256,
    )
    db.add(bad_av)
    db.flush()
    asset.current_version_id = bad_av.id
    db.commit()

    flags = run_unit_guardrails(unit.id, db)
    placeholder_flags = [f for f in flags if f.code == "placeholder_content"]
    assert len(placeholder_flags) > 0
    assert "generic placeholder option" in placeholder_flags[0].message

