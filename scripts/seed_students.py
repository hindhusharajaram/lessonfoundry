import os
import random
import sys
from datetime import datetime, timezone, timedelta

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import SessionLocal
from db.models import Student, QuizAttempt, AttemptAnswer, Unit, Publication, Slot

STUDENT_NAMES = [
    "Aria Montgomery", "Liam Vance", "Sophia Martinez", "Ethan Wright", "Maya Patel",
    "Noah Jackson", "Olivia Kim", "Lucas Silva", "Emma Watson", "James Chen",
    "Chloe Bennett", "Benjamin Lee", "Mia Davis", "Alexander Gray", "Charlotte Brown",
    "Henry Wilson", "Amelia Taylor", "Daniel Clark", "Harper Lewis", "Matthew Hall",
    "Evelyn Allen", "Jackson Young", "Abigail King", "Sebastian Scott", "Emily Green",
    "David Adams", "Elizabeth Baker", "Carter Nelson", "Avery Hill", "Logan Mitchell"
]

def seed_synthetic_students(unit_id: int = 1):
    db = SessionLocal()
    try:
        unit = db.query(Unit).filter(Unit.id == unit_id).first()
        if not unit:
            print(f"[!] Unit #{unit_id} not found. Please run scripts/demo_generate.py first.")
            return

        # Check if unit has published status
        pub = db.query(Publication).filter(Publication.unit_id == unit_id).first()
        if not pub:
            print(f"[!] Unit #{unit_id} is not published yet. Creating a publication snapshot...")
            approved_slots = [s for s in unit.slots if s.asset and s.asset.status == "approved"]
            if not approved_slots:
                # Approve all generated assets for demo purposes
                for s in unit.slots:
                    if s.asset:
                        s.asset.status = "approved"
                        s.asset.locked = True
                db.commit()
                approved_slots = [s for s in unit.slots if s.asset and s.asset.status == "approved"]

            pub = Publication(
                unit_id=unit.id,
                class_label="Class 10-A",
                snapshot={"approved_assets_count": len(approved_slots), "assets": []},
            )
            db.add(pub)
            unit.status = "published"
            db.commit()

        # Find quiz / assessment assets
        assessment_slots = [
            s for s in unit.slots
            if s.type in ["quiz_item", "practice_foundation", "practice_advanced"]
            and s.asset and s.asset.current_version
        ]

        if not assessment_slots:
            print("[!] No assessment slots found in unit. Run generator first.")
            return

        print(f"[*] Seeding 30 synthetic students and quiz attempts for Unit #{unit_id} ('{unit.title}')...")

        # Clear previous synthetic attempts on this unit
        existing_attempts = db.query(QuizAttempt).filter(QuizAttempt.unit_id == unit_id).all()
        for a in existing_attempts:
            db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == a.id).delete()
            db.delete(a)
        db.commit()

        created_count = 0
        for i, name in enumerate(STUDENT_NAMES):
            student = db.query(Student).filter(Student.name == name).first()
            if not student:
                student = Student(name=name, class_label="Class 10-A", synthetic=True)
                db.add(student)
                db.flush()

            # Randomize student proficiency: 20% high (90-100), 50% medium (70-85), 30% struggling (30-65)
            tier = random.choices(["high", "med", "low"], weights=[0.25, 0.50, 0.25])[0]
            if tier == "high":
                pass_prob = 0.92
            elif tier == "med":
                pass_prob = 0.76
            else:
                pass_prob = 0.45

            started_time = datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 48), minutes=random.randint(1, 50))
            submitted_time = started_time + timedelta(minutes=random.randint(5, 18))

            attempt = QuizAttempt(
                student_id=student.id,
                unit_id=unit.id,
                started_at=started_time,
                submitted_at=submitted_time,
                score=0.0,
            )
            db.add(attempt)
            db.flush()

            correct_count = 0
            for slot_idx, slot in enumerate(assessment_slots):
                correct_idx = slot.asset.current_version.content.get("correct_index", 0)
                
                # Intentionally induce a learning gap on objective #2 or advanced slots
                item_prob = pass_prob
                if slot.objective_id == 2 or "advanced" in slot.type:
                    item_prob = max(0.25, pass_prob - 0.35)

                is_correct = (random.random() < item_prob)
                if is_correct:
                    chosen = correct_idx
                    correct_count += 1
                else:
                    # Choose a distractor
                    wrong_choices = [c for c in [0, 1, 2, 3] if c != correct_idx]
                    chosen = random.choice(wrong_choices) if wrong_choices else 0

                time_taken = random.randint(15, 90)
                ans = AttemptAnswer(
                    attempt_id=attempt.id,
                    asset_id=slot.asset.id,
                    chosen_index=chosen,
                    correct=is_correct,
                    time_seconds=time_taken,
                )
                db.add(ans)

            attempt.score = round((correct_count / len(assessment_slots)) * 100, 1)
            created_count += 1

        db.commit()
        print(f"[+] Successfully seeded {created_count} synthetic student attempts for Unit #{unit_id}.")

    finally:
        db.close()

if __name__ == "__main__":
    unit_id_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    seed_synthetic_students(unit_id_arg)
