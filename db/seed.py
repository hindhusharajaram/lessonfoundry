from db.database import SessionLocal
from db.models import Student


def seed_database():
    db = SessionLocal()
    try:
        # Check if students exist
        existing_students = db.query(Student).count()
        if existing_students == 0:
            students = [
                Student(name="Alex Chen", class_label="Biology 101-A", synthetic=True),
                Student(name="Maya Patel", class_label="Biology 101-A", synthetic=True),
                Student(name="Jordan Smith", class_label="Biology 101-A", synthetic=True),
                Student(name="Taylor Jones", class_label="Biology 101-B", synthetic=True),
                Student(name="Samira Khan", class_label="Biology 101-B", synthetic=True),
            ]
            db.add_all(students)
            db.commit()
            print(f"Seeded {len(students)} synthetic students.")
        else:
            print(f"Found {existing_students} existing students, skipping seed.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
