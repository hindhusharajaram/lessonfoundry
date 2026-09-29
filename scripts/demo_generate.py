import json
import os
import sys
from pathlib import Path
from unittest.mock import patch

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from api.main import app
from engine.generator import (
    ExplanationContent,
    ExampleContent,
    QuizItemContent,
    RevisionContent,
)
from engine.solver import SolverAnswer

client = TestClient(app)

_Q_COUNTER = 0

SAMPLE_QUESTIONS = [
    {
        "question": "Where do the light-dependent reactions of photosynthesis take place?",
        "options": ["Across the thylakoid membrane", "In the outer membrane", "Inside the nucleus", "In the vacuole"],
        "correct_index": 0,
        "rationale": "The light-dependent reactions occur across the thylakoid membrane.",
        "quote": "The light-dependent reactions occur across the thylakoid membrane.",
        "bloom": "Remember",
    },
    {
        "question": "What process replaces the electrons lost by chlorophyll in Photosystem II?",
        "options": ["Oxidative phosphorylation", "Photolysis of water", "Fermentation", "Citric acid cycle"],
        "correct_index": 1,
        "rationale": "Water molecules undergo photolysis, splitting into protons, electrons, and oxygen.",
        "quote": "water molecules undergo photolysis, splitting into protons, electrons, and diatomic oxygen gas.",
        "bloom": "Understand",
    },
    {
        "question": "Which enzyme catalyzes carbon fixation during the Calvin cycle in the stroma?",
        "options": ["ATP Synthase", "RuBisCO", "DNA Polymerase", "Amylase"],
        "correct_index": 1,
        "rationale": "RuBisCO attaches CO2 to RuBP in the chloroplast stroma.",
        "quote": "The key enzyme catalyzing the initial carbon fixation step is ribulose-1,5-bisphosphate carboxylase-oxygenase, commonly known as RuBisCO.",
        "bloom": "Apply",
    },
    {
        "question": "What molecule is produced when 3-PGA is reduced using ATP and NADPH in the Calvin cycle?",
        "options": ["Glyceraldehyde-3-phosphate (G3P)", "Pyruvate", "Lactic acid", "Acetyl-CoA"],
        "correct_index": 0,
        "rationale": "3-PGA is reduced to form glyceraldehyde-3-phosphate (G3P).",
        "quote": "Through subsequent reduction steps powered by ATP and NADPH, 3-PGA is converted into glyceraldehyde-3-phosphate (G3P).",
        "bloom": "Understand",
    },
    {
        "question": "What drives ATP synthase to generate ATP across the thylakoid membrane?",
        "options": ["Electrochemical proton gradient", "Sodium potassium pump", "Direct sunlight pressure", "Mechanical vibration"],
        "correct_index": 0,
        "rationale": "Proton motive force across the thylakoid membrane drives ATP synthase.",
        "quote": "This proton motive force drives ATP synthase to generate adenosine triphosphate (ATP)",
        "bloom": "Analyze",
    },
    {
        "question": "How many molecules of fixed carbon dioxide yield one net molecule of G3P exiting the cycle?",
        "options": ["Six molecules", "Three molecules", "One molecule", "Twelve molecules"],
        "correct_index": 1,
        "rationale": "For every three molecules of CO2 fixed, one net molecule of G3P exits the cycle.",
        "quote": "For every three molecules of CO2 fixed, one net molecule of G3P exits the cycle to form glucose and other organic compounds",
        "bloom": "Analyze",
    },
    {
        "question": "What are the fluid-filled spaces surrounding the thylakoids called?",
        "options": ["Cytosol", "Stroma", "Matrix", "Lumen"],
        "correct_index": 1,
        "rationale": "The fluid-filled space surrounding the thylakoids is called the stroma.",
        "quote": "The fluid-filled space surrounding the thylakoids is called the stroma.",
        "bloom": "Remember",
    },
    {
        "question": "Which wavelength colors are primarily absorbed by chlorophyll pigments?",
        "options": ["Green and yellow", "Blue and red", "Infrared and ultraviolet", "Only orange"],
        "correct_index": 1,
        "rationale": "Chlorophyll absorbs blue and red wavelengths while reflecting green.",
        "quote": "The thylakoid membranes contain chlorophyll, the primary green pigment responsible for absorbing blue and red wavelengths of light while reflecting green light.",
        "bloom": "Understand",
    },
]


def get_mock_planner_eval(obj, chunks, db_sess):
    text_lower = obj.text.lower()
    if "mendelian" in text_lower or "dihybrid" in text_lower:
        obj.supported = False
        obj.support_note = "Source covers chloroplast photosynthesis; Mendelian genetics and dihybrid inheritance are absent."
        return False
    elif "light-dependent" in text_lower or "thylakoid" in text_lower:
        obj.supported = True
        obj.support_note = "Supported by chunk 2: Thylakoid membrane reactions, photolysis of water, and ATP/NADPH synthesis."
        return True
    elif "calvin" in text_lower or "rubisco" in text_lower:
        obj.supported = True
        obj.support_note = "Supported by chunk 3: Calvin cycle in stroma with RuBisCO carbon fixation."
        return True
    obj.supported = True
    return True


def get_mock_generator(prompt, schema, **kwargs):
    global _Q_COUNTER
    schema_name = schema.__name__
    meta = {"model": "gemini-2.5-flash", "latency_ms": 250, "attempts": 1, "prompt_version": "1.0"}

    if schema_name == "ExplanationContent":
        obj = ExplanationContent(
            title="Photosynthetic Light Reactions in the Thylakoid Membrane",
            summary="Light-dependent reactions convert solar photons into biochemical energy carriers ATP and NADPH.",
            sentences=[
                {
                    "text": "The light-dependent reactions take place across the thylakoid membrane within chloroplasts.",
                    "quote": "The light-dependent reactions occur across the thylakoid membrane.",
                },
                {
                    "text": "Water molecules undergo photolysis to replace excited electrons lost by chlorophyll.",
                    "quote": "water molecules undergo photolysis, splitting into protons, electrons, and diatomic oxygen gas.",
                },
                {
                    "text": "A proton motive force drives ATP synthase to produce ATP.",
                    "quote": "This proton motive force drives ATP synthase to generate adenosine triphosphate (ATP)",
                },
            ],
            glossary=[
                {
                    "term": "Thylakoid",
                    "definition": "Disc-like membrane sacs containing chlorophyll organized into grana.",
                    "quote": "Chloroplasts contain an internal membrane system organized into disc-like sacs called thylakoids",
                },
                {
                    "term": "Photolysis",
                    "definition": "Light-driven splitting of water molecules into protons, electrons, and oxygen.",
                    "quote": "water molecules undergo photolysis, splitting into protons, electrons, and diatomic oxygen gas.",
                },
                {
                    "term": "Stroma",
                    "definition": "The fluid-filled space surrounding the thylakoids in chloroplasts.",
                    "quote": "The fluid-filled space surrounding the thylakoids is called the stroma.",
                },
                {
                    "term": "RuBisCO",
                    "definition": "Key enzyme catalyzing the initial carbon fixation step.",
                    "quote": "The key enzyme catalyzing the initial carbon fixation step is ribulose-1,5-bisphosphate carboxylase-oxygenase, commonly known as RuBisCO.",
                },
            ],
        )
        return obj, meta

    elif schema_name == "ExampleContent":
        obj = ExampleContent(
            problem="Determine the source of atmospheric oxygen released during plant photosynthesis.",
            steps=[
                {
                    "text": "Identify the stage where water is split in the photosynthetic machinery.",
                    "quote": "To replace lost electrons, water molecules undergo photolysis, splitting into protons, electrons, and diatomic oxygen gas.",
                },
                {
                    "text": "Recognize that diatomic oxygen gas is produced as a direct byproduct of this water cleavage.",
                    "quote": "plants consume carbon dioxide and water to synthesize six-carbon sugar molecules while releasing molecular oxygen as a vital byproduct.",
                },
            ],
            answer="Molecular oxygen (O2) is generated exclusively from the photolysis of water molecules during light-dependent reactions.",
        )
        return obj, meta

    elif schema_name == "QuizItemContent":
        q_data = SAMPLE_QUESTIONS[_Q_COUNTER % len(SAMPLE_QUESTIONS)]
        _Q_COUNTER += 1
        diff = "easy" if "foundation" in prompt else ("advanced" if "advanced" in prompt else "medium")
        obj = QuizItemContent(
            question=q_data["question"],
            options=q_data["options"],
            correct_index=q_data["correct_index"],
            rationale=q_data["rationale"],
            quote=q_data["quote"],
            bloom=q_data["bloom"],
            difficulty=diff,
        )
        return obj, meta

    elif schema_name == "RevisionContent":
        obj = RevisionContent(
            key_points=[
                {
                    "text": "Light reactions in thylakoids produce ATP and NADPH while releasing oxygen from water.",
                    "quote": "The light-dependent reactions occur across the thylakoid membrane.",
                    "objective_id": 1,
                },
                {
                    "text": "RuBisCO fixes CO2 in the stroma to form carbohydrates.",
                    "quote": "The key enzyme catalyzing the initial carbon fixation step is ribulose-1,5-bisphosphate carboxylase-oxygenase, commonly known as RuBisCO.",
                    "objective_id": 2,
                },
            ],
            terms=[
                {
                    "term": "RuBisCO",
                    "definition": "Key enzyme catalyzing the initial carbon fixation step.",
                    "quote": "The key enzyme catalyzing the initial carbon fixation step is ribulose-1,5-bisphosphate carboxylase-oxygenase, commonly known as RuBisCO.",
                }
            ],
        )
        return obj, meta

    elif schema_name == "SolverAnswer":
        # Extract correct answer from options in prompt
        # In mock solver, match the question's supporting quote and correct choice
        chosen = 0
        supporting = "The light-dependent reactions occur across the thylakoid membrane."
        for q in SAMPLE_QUESTIONS:
            if q["question"] in prompt:
                chosen = q["correct_index"]
                supporting = q["quote"]
                break

        obj = SolverAnswer(
            chosen_index=chosen,
            supporting_quote=supporting,
            rationale="Verified directly from source reference text.",
        )
        return obj, meta

    return schema(), meta


def run_demo():
    print("=" * 75)
    print("LessonFoundry End-to-End Pipeline & Pack Health Demo")
    print("=" * 75)

    # 1. Ingest Sample Source
    sample_path = Path(__file__).resolve().parent.parent / "data" / "samples" / "photosynthesis.txt"
    sample_text = sample_path.read_text(encoding="utf-8")
    print(f"\n1. Ingesting Source Document ({len(sample_text)} characters)...")

    upload_resp = client.post(
        "/api/sources/upload",
        data={"title": "Photosynthesis & Calvin Cycle", "text": sample_text},
        headers={"X-Role": "teacher"},
    )
    assert upload_resp.status_code == 201
    upload_data = upload_resp.json()
    source_id = upload_data["source_id"]
    print(f"   -> Source ID: {source_id} (Version {upload_data['version_no']}, {upload_data['chunks_count']} Chunks)")
    print(f"   -> Injection Flags: {upload_data['injection_flags']['count']} found (flagged={upload_data['injection_flags']['flagged']})")

    # 2. Create Unit
    print("\n2. Creating Lesson Unit...")
    unit_resp = client.post(
        "/api/units",
        json={
            "title": "Photosynthetic Energy Transformations",
            "source_id": source_id,
            "target_grade": "High School Biology",
            "difficulty": "medium",
            "language": "English",
            "quiz_count": 4,
        },
        headers={"X-Role": "teacher"},
    )
    assert unit_resp.status_code == 201
    unit_id = unit_resp.json()["unit_id"]
    print(f"   -> Created Unit ID: {unit_id}")

    # 3. Set Objectives (2 supported, 1 intentionally unsupported)
    print("\n3. Setting Unit Objectives (including 1 intentionally unsupported objective)...")
    objectives_payload = [
        {
            "text": "Explain light-dependent reactions across the thylakoid membrane, photolysis of water, and ATP/NADPH synthesis.",
            "bloom_target": "Understand",
        },
        {
            "text": "Describe the Calvin cycle stages catalyzed by RuBisCO in the chloroplast stroma that fix CO2 into G3P.",
            "bloom_target": "Apply",
        },
        {
            "text": "Calculate phenotypic ratios of dihybrid crosses using Mendelian independent assortment.",
            "bloom_target": "Analyze",
        },
    ]

    obj_resp = client.put(f"/api/units/{unit_id}/objectives", json=objectives_payload, headers={"X-Role": "teacher"})
    assert obj_resp.status_code == 200
    print(f"   -> {obj_resp.json()['objectives_count']} objectives registered.")

    # 4. Plan Unit with Gap Detection
    print("\n4. Running AI Gap Detection & Blueprint Planning (POST /api/units/{id}/plan)...")
    api_key = os.getenv("GEMINI_API_KEY", "")
    has_live_key = bool(api_key and api_key.startswith("AIza") and api_key != "your_gemini_api_key_here")

    if not has_live_key:
        with patch("engine.planner.evaluate_objective_gap", side_effect=get_mock_planner_eval):
            plan_resp = client.post(f"/api/units/{unit_id}/plan", headers={"X-Role": "teacher"})
    else:
        plan_resp = client.post(f"/api/units/{unit_id}/plan", headers={"X-Role": "teacher"})

    assert plan_resp.status_code == 200
    plan_data = plan_resp.json()
    print(f"   -> Supported Objectives: {plan_data['supported_objectives_count']}")
    print(f"   -> Refused / Unsupported Objectives: {plan_data['unsupported_objectives_count']}")
    for unsup in plan_data.get("unsupported_details", []):
        print(f"      * Refused Objective #{unsup['id']}: \"{unsup['text']}\"")
        print(f"        Reason: {unsup['reason']}")
    print(f"   -> Blueprint Slots: {plan_data['slots_count']} slots created (0 slots for unsupported objective)")

    # 5. Generate Learning Pack Content
    print("\n5. Generating Evidence-Locked Learning Pack (POST /api/units/{id}/generate)...")
    if not has_live_key:
        with patch("engine.generator.generate_json", side_effect=get_mock_generator), patch("engine.solver.generate_json", side_effect=get_mock_generator):
            gen_resp = client.post(f"/api/units/{unit_id}/generate", headers={"X-Role": "teacher"})
    else:
        gen_resp = client.post(f"/api/units/{unit_id}/generate", headers={"X-Role": "teacher"})

    assert gen_resp.status_code == 200
    gen_data = gen_resp.json()
    print(f"   -> Total Slots: {gen_data['total_slots']} | Successfully Generated: {gen_data['generated_count']}")

    # 6. Run Independent Solver & Guardrails Pack Health Check
    print("\n6. Running Guardrails & Independent Solver Pack Health Check (GET /api/units/{id}/health)...")
    health_resp = client.get(f"/api/units/{unit_id}/health", headers={"X-Role": "teacher"})
    assert health_resp.status_code == 200
    health_data = health_resp.json()

    print("\n" + "=" * 75)
    print(f"PACK HEALTH DIAGNOSTIC REPORT: {health_data['title']}")
    print("=" * 75)
    print(f"Composite Health Score: {health_data['health_score']} / 100")
    print(f"Grounding Ratio: {health_data['grounding_percentage']}% ({health_data['verified_claims']}/{health_data['total_claims']} claims verified)")
    print(f"Solver Verification Rate: {health_data['solver_verification_rate']}% ({health_data['solver_matched_slots']}/{health_data['total_quiz_slots']} questions dual-verified)")
    print(f"Duplicate Questions: {health_data['duplicate_count']}")
    print(f"Open Quality Flags: {health_data['open_flags_count']['total']} (Error: {health_data['open_flags_count']['error']}, Warning: {health_data['open_flags_count']['warning']}, Info: {health_data['open_flags_count']['info']})")

    # 7. Approve Assets via Teacher Studio
    print("\n7. Teacher Review & Quality Gate Approval...")
    pack_resp = client.get(f"/api/units/{unit_id}/pack", headers={"X-Role": "teacher"})
    pack_data = pack_resp.json()

    approved_count = 0
    for obj in pack_data["objectives"]:
        for slot in obj["slots"]:
            asset_info = slot.get("asset")
            if asset_info and asset_info.get("asset_id"):
                app_res = client.post(
                    f"/api/assets/{asset_info['asset_id']}/status",
                    json={"status": "approved", "note": "Approved during demo review"},
                    headers={"X-Role": "teacher"},
                )
                if app_res.status_code == 200:
                    approved_count += 1

    print(f"   -> Approved {approved_count} assets (locked=True).")

    # 8. Publish Unit & Student Attempt
    print("\n8. Publishing Learning Pack to Class (POST /api/units/{id}/publish)...")
    pub_res = client.post(
        f"/api/units/{unit_id}/publish",
        json={"class_label": "Biology Period 3"},
        headers={"X-Role": "teacher"},
    )
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    print(f"   -> Unit published! Publication ID: {pub_data['publication_id']} | Approved Snapshot Items: {pub_data['approved_assets_count']}")

    print("\n9. Student Simulation: Taking Quiz via /api/student/units/{id}...")
    stud_view = client.get(f"/api/student/units/{unit_id}", headers={"X-Role": "student", "X-Student-Id": "101"})
    assert stud_view.status_code == 200
    stud_slots = stud_view.json()["slots"]
    print(f"   -> Student sees {len(stud_slots)} approved assets (Answer keys and rationale are stripped).")

    # Submit answers
    quiz_slots = [s for s in stud_slots if s["type"] in ["quiz_item", "practice_foundation", "practice_advanced"]]
    if quiz_slots:
        answers_payload = [
            {"asset_id": s["asset_id"], "chosen_index": 1, "time_seconds": 12}
            for s in quiz_slots
        ]
        attempt_res = client.post(
            "/api/student/attempts",
            json={"unit_id": unit_id, "answers": answers_payload},
            headers={"X-Role": "student", "X-Student-Id": "101"},
        )
        assert attempt_res.status_code == 201
        attempt_data = attempt_res.json()
        print(f"   -> Student Submission Recorded. Score: {attempt_data['score']}%.")

    # 10. Impact Engine Analysis
    print("\n10. Testing Change Impact Engine (GET /api/units/{id}/impact?change=difficulty:medium->advanced)...")
    impact_res = client.get(
        f"/api/units/{unit_id}/impact?change=difficulty:medium->advanced",
        headers={"X-Role": "teacher"},
    )
    assert impact_res.status_code == 200
    impact_data = impact_res.json()
    print(f"   -> Impact Analysis: {impact_data['affected_count']} affected slots, {impact_data['unaffected_count']} unaffected slots.")
    print(f"   -> Approved-but-stale items safely preserved: {impact_data['approved_stale_count']}")

    print("\n" + "=" * 75)
    print("Full LessonFoundry Studio Pipeline Verified Successfully.")
    print("=" * 75)


if __name__ == "__main__":
    run_demo()
