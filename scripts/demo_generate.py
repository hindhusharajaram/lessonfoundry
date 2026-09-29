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
from engine.planner import ObjectiveSupportEvaluation

client = TestClient(app)


def get_mock_planner_eval(obj, chunks, db_sess):
    """Mock planner evaluation for offline demo execution."""
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
    """Provide realistic, evidence-locked responses matching photosynthesis source text."""
    schema_name = schema.__name__
    meta = {"model": "gemini-2.5-flash", "latency_ms": 320, "attempts": 1, "prompt_version": "1.0"}

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
        obj = QuizItemContent(
            question="Which enzyme catalyzes the initial carbon fixation step in the Calvin cycle?",
            options=[
                "ATP Synthase",
                "RuBisCO",
                "Ferredoxin-NADP+ Reductase",
                "Chlorophyllase",
            ],
            correct_index=1,
            rationale="RuBisCO (ribulose-1,5-bisphosphate carboxylase-oxygenase) attaches carbon dioxide to RuBP in the chloroplast stroma.",
            quote="The key enzyme catalyzing the initial carbon fixation step is ribulose-1,5-bisphosphate carboxylase-oxygenase, commonly known as RuBisCO.",
            bloom="Remember",
            difficulty="medium",
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
                    "definition": "Enzyme responsible for initial carbon fixation in the stroma.",
                    "quote": "The key enzyme catalyzing the initial carbon fixation step is ribulose-1,5-bisphosphate carboxylase-oxygenase, commonly known as RuBisCO.",
                }
            ],
        )
        return obj, meta

    return schema(), meta


def run_demo():
    print("=" * 70)
    print("LessonFoundry End-to-End Pipeline Demo")
    print("=" * 70)

    # 1. Load sample source file
    sample_path = Path(__file__).resolve().parent.parent / "data" / "samples" / "photosynthesis.txt"
    if not sample_path.exists():
        print(f"Error: Sample source file not found at {sample_path}")
        return

    sample_text = sample_path.read_text(encoding="utf-8")
    print(f"\n1. Ingesting Source Document ({len(sample_text)} characters)...")

    upload_resp = client.post(
        "/api/sources/upload",
        data={"title": "Photosynthesis & Calvin Cycle", "text": sample_text},
        headers={"X-Role": "teacher"},
    )
    if upload_resp.status_code != 201:
        print(f"Upload failed: {upload_resp.text}")
        return

    upload_data = upload_resp.json()
    source_id = upload_data["source_id"]
    print(f"   -> Source ID: {source_id} (Version {upload_data['version_no']}, {upload_data['chunks_count']} Chunks)")
    print(f"   -> Injection Flags: {upload_data['injection_flags']['count']} detected (flagged={upload_data['injection_flags']['flagged']})")

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
            "constraints": {"max_words": 150},
        },
        headers={"X-Role": "teacher"},
    )
    if unit_resp.status_code != 201:
        print(f"Unit creation failed: {unit_resp.text}")
        return

    unit_id = unit_resp.json()["unit_id"]
    print(f"   -> Created Unit ID: {unit_id} (Pinned Source Version: {unit_resp.json()['pinned_source_version_id']})")

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

    obj_resp = client.put(
        f"/api/units/{unit_id}/objectives",
        json=objectives_payload,
        headers={"X-Role": "teacher"},
    )
    if obj_resp.status_code != 200:
        print(f"Setting objectives failed: {obj_resp.text}")
        return
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

    if plan_resp.status_code != 200:
        print(f"Plan failed: {plan_resp.text}")
        return

    plan_data = plan_resp.json()
    print(f"   -> Supported Objectives: {plan_data['supported_objectives_count']}")
    print(f"   -> Refused / Unsupported Objectives: {plan_data['unsupported_objectives_count']}")
    for unsup in plan_data.get("unsupported_details", []):
        print(f"      * Refused Objective #{unsup['id']}: \"{unsup['text']}\"")
        print(f"        Reason: {unsup['reason']}")
    print(f"   -> Generated Blueprint Slots: {plan_data['slots_count']} slots (0 slots for unsupported objective)")

    # 5. Generate Learning Pack Content
    print("\n5. Generating Evidence-Locked Learning Pack (POST /api/units/{id}/generate)...")
    if not has_live_key:
        with patch("engine.generator.generate_json", side_effect=get_mock_generator):
            gen_resp = client.post(f"/api/units/{unit_id}/generate", headers={"X-Role": "teacher"})
    else:
        gen_resp = client.post(f"/api/units/{unit_id}/generate", headers={"X-Role": "teacher"})

    if gen_resp.status_code != 200:
        print(f"Generation failed: {gen_resp.text}")
        return

    gen_data = gen_resp.json()
    print(f"   -> Total Slots: {gen_data['total_slots']}")
    print(f"   -> Successfully Generated: {gen_data['generated_count']}")
    print(f"   -> Skipped (Resumed): {gen_data['skipped_count']}")
    print(f"   -> Failed: {gen_data['failed_count']}")

    # 6. Fetch Full Pack & Quality Metrics
    print("\n6. Fetching Complete Learning Pack (GET /api/units/{id}/pack)...")
    pack_resp = client.get(
        f"/api/units/{unit_id}/pack",
        headers={"X-Role": "teacher"},
    )
    if pack_resp.status_code != 200:
        print(f"Pack retrieval failed: {pack_resp.text}")
        return

    pack_data = pack_resp.json()
    print("\n" + "=" * 70)
    print(f"LEARNING PACK REPORT: {pack_data['title']}")
    print("=" * 70)
    print(f"Overall Claim Verification Rate: {pack_data['overall_verification_ratio'] * 100:.1f}% ({pack_data['verified_claims']}/{pack_data['total_claims']} verified claims)")
    print(f"Quality Flags: {len(pack_data['quality_flags'])}")
    for qf in pack_data["quality_flags"]:
        print(f"  - [{qf['severity'].upper()}] {qf['code']}: {qf['message']}")

    print("\nObjectives & Generated Slots:")
    for obj in pack_data["objectives"]:
        status_str = "SUPPORTED" if obj["supported"] else "UNSUPPORTED (REFUSED)"
        print(f"\n[Objective {obj['position']}] {obj['text']}")
        print(f"Status: {status_str} | Target Bloom: {obj['bloom_target']}")
        if not obj["supported"]:
            print(f"Support Note: {obj['support_note']}")
            print("Slots: None (evidence boundary maintained, no orphans created)")
        else:
            print(f"Generated Slots ({len(obj['slots'])} total):")
            for slot in obj["slots"]:
                asset = slot.get("asset")
                v_no = asset["version_no"] if asset else "None"
                a_status = asset["status"] if asset else "None"
                v_ratio = asset.get("verification", {}).get("verification_ratio", 0.0) if asset else 0.0
                print(f"  - Slot #{slot['position']} [{slot['type']}] (Bloom: {slot['bloom_tag']}, Diff: {slot['difficulty']}) | Asset: {a_status} (v{v_no}, ver={v_ratio*100:.0f}%)")
                if asset and asset.get("content"):
                    c = asset["content"]
                    if slot["type"] == "explanation":
                        print(f"    Title: {c.get('title')}")
                        print(f"    Sentences: {len(c.get('sentences', []))} | Glossary: {len(c.get('glossary', []))}")
                    elif slot["type"] == "quiz_item":
                        print(f"    Question: {c.get('question')}")
                        print(f"    Options: {c.get('options')} (Correct: #{c.get('correct_index')})")

    print("\n" + "=" * 70)
    print("Demo Execution Completed Successfully.")
    print("=" * 70)


if __name__ == "__main__":
    run_demo()
