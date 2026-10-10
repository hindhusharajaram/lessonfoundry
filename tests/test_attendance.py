import uuid
import pytest
from fastapi.testclient import TestClient
from api.main import app
from db.database import SessionLocal
from db.models import (
    Attendance,
    ClassSession,
    Enrollment,
    Student,
    Unit,
    User,
    utc_now,
)

client = TestClient(app)


@pytest.fixture
def test_data():
    """Sets up two teachers, 5 students enrolled with Teacher 1, and a session."""
    session = SessionLocal()
    uid = uuid.uuid4().hex[:6]

    # Teacher 1
    t1 = User(
        email=f"t1_{uid}@lessonfoundry.edu",
        name=f"Teacher 1 {uid}",
        role="teacher",
        join_code=f"T1{uid.upper()}",
    )
    # Teacher 2
    t2 = User(
        email=f"t2_{uid}@lessonfoundry.edu",
        name=f"Teacher 2 {uid}",
        role="teacher",
        join_code=f"T2{uid.upper()}",
    )
    session.add_all([t1, t2])
    session.flush()

    class_name = f"Class-Physics-{uid}"

    # 5 enrolled students for Teacher 1
    students = []
    for i in range(1, 6):
        u = User(
            email=f"st_{i}_{uid}@lessonfoundry.edu",
            name=f"Student {i} {uid}",
            role="student",
        )
        session.add(u)
        session.flush()

        st = Student(
            student_user_id=u.id,
            name=u.name,
            email=u.email,
            class_label=class_name,
            synthetic=False,
        )
        session.add(st)
        session.flush()

        enr = Enrollment(
            teacher_user_id=t1.id,
            student_user_id=u.id,
        )
        session.add(enr)
        students.append(st)

    # Session owned by Teacher 1
    cs = ClassSession(
        teacher_user_id=t1.id,
        title=f"Physics 101 Lecture {uid}",
        class_label=class_name,
        is_active=True,
    )
    session.add(cs)
    session.commit()
    session.refresh(cs)

    yield {
        "teacher1": t1,
        "teacher2": t2,
        "session": cs,
        "students": students,
        "class_label": class_name,
    }

    # Teardown
    try:
        session.query(Attendance).filter(Attendance.session_id == cs.id).delete()
        session.query(ClassSession).filter(ClassSession.id == cs.id).delete()
        for st in students:
            session.query(Enrollment).filter(Enrollment.student_user_id == st.student_user_id).delete()
            session.query(Student).filter(Student.id == st.id).delete()
            session.query(User).filter(User.id == st.student_user_id).delete()
        session.query(User).filter(User.id.in_([t1.id, t2.id])).delete()
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()


def test_teacher_authorization_access(test_data):
    """Test that authorized teacher can access session attendance, but unauthorized teacher is blocked (403)."""
    t1 = test_data["teacher1"]
    t2 = test_data["teacher2"]
    sess = test_data["session"]

    # 1. Teacher 1 (owner) accesses session -> 200 OK
    res1 = client.get(
        f"/api/teacher/sessions/{sess.id}/attendance",
        headers={"X-Role": "teacher", "X-User-Id": str(t1.id)},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["session_id"] == sess.id
    assert data1["total_students"] == 5

    # 2. Teacher 2 (unauthorized) tries to access Teacher 1's session -> 403 Forbidden
    res2 = client.get(
        f"/api/teacher/sessions/{sess.id}/attendance",
        headers={"X-Role": "teacher", "X-User-Id": str(t2.id)},
    )
    assert res2.status_code == 403
    assert "Unauthorized" in res2.json()["detail"]


def test_mark_student_present_and_counts(test_data):
    """Test marking students present, checking present count, absent count, and attendance percentage."""
    t1 = test_data["teacher1"]
    sess = test_data["session"]
    students = test_data["students"]

    # Initial state: 0 present, 5 absent -> 0.0%
    res_initial = client.get(
        f"/api/teacher/sessions/{sess.id}/attendance",
        headers={"X-Role": "teacher", "X-User-Id": str(t1.id)},
    )
    assert res_initial.status_code == 200
    init_data = res_initial.json()
    assert init_data["total_students"] == 5
    assert init_data["present_count"] == 0
    assert init_data["absent_count"] == 5
    assert init_data["attendance_percentage"] == 0.0
    assert len(init_data["absent_students"]) == 5
    assert len(init_data["present_students"]) == 0

    # Mark Student 0 present
    res_mark = client.post(
        f"/api/sessions/{sess.id}/attendance",
        json={"student_id": students[0].id, "status": "present"},
        headers={"X-Role": "teacher", "X-User-Id": str(t1.id)},
    )
    assert res_mark.status_code == 200
    assert res_mark.json()["summary"]["present_count"] == 1
    assert res_mark.json()["summary"]["absent_count"] == 4
    assert res_mark.json()["summary"]["attendance_percentage"] == 20.0

    # Mark Student 1 present
    client.post(
        f"/api/sessions/{sess.id}/attendance",
        json={"student_id": students[1].id, "status": "present"},
        headers={"X-Role": "teacher", "X-User-Id": str(t1.id)},
    )

    # Now verify GET report: 2 present, 3 absent -> 40.0%
    res_updated = client.get(
        f"/api/teacher/sessions/{sess.id}/attendance",
        headers={"X-Role": "teacher", "X-User-Id": str(t1.id)},
    )
    assert res_updated.status_code == 200
    data = res_updated.json()
    assert data["total_students"] == 5
    assert data["present_count"] == 2
    assert data["absent_count"] == 3
    assert data["attendance_percentage"] == 40.0

    present_names = [s["name"] for s in data["present_students"]]
    absent_names = [s["name"] for s in data["absent_students"]]
    assert students[0].name in present_names
    assert students[1].name in present_names
    assert students[2].name in absent_names
    assert students[3].name in absent_names
    assert students[4].name in absent_names


def test_duplicate_attendance_prevention(test_data):
    """Test that marking the same student present multiple times does NOT create duplicate records."""
    t1 = test_data["teacher1"]
    sess = test_data["session"]
    target_student = test_data["students"][0]

    # First mark
    res1 = client.post(
        f"/api/sessions/{sess.id}/attendance",
        json={"student_id": target_student.id, "status": "present"},
        headers={"X-Role": "teacher", "X-User-Id": str(t1.id)},
    )
    assert res1.status_code == 200

    # Second mark (duplicate attempt)
    res2 = client.post(
        f"/api/sessions/{sess.id}/attendance",
        json={"student_id": target_student.id, "status": "present"},
        headers={"X-Role": "teacher", "X-User-Id": str(t1.id)},
    )
    assert res2.status_code == 200

    # Verify database has strictly 1 record for this (session_id, student_id)
    db = SessionLocal()
    records = (
        db.query(Attendance)
        .filter(Attendance.session_id == sess.id, Attendance.student_id == target_student.id)
        .all()
    )
    assert len(records) == 1
    assert records[0].status == "present"
    db.close()


def test_bulk_attendance_updates(test_data):
    """Test marking bulk attendance records for a session."""
    t1 = test_data["teacher1"]
    sess = test_data["session"]
    students = test_data["students"]

    bulk_payload = {
        "records": [
            {"student_id": students[0].id, "status": "present"},
            {"student_id": students[1].id, "status": "present"},
            {"student_id": students[2].id, "status": "present"},
            {"student_id": students[3].id, "status": "present"},
            {"student_id": students[4].id, "status": "absent"},
        ]
    }

    res_bulk = client.post(
        f"/api/sessions/{sess.id}/attendance/bulk",
        json=bulk_payload,
        headers={"X-Role": "teacher", "X-User-Id": str(t1.id)},
    )
    assert res_bulk.status_code == 200
    summary = res_bulk.json()["summary"]
    assert summary["total_students"] == 5
    assert summary["present_count"] == 4
    assert summary["absent_count"] == 1
    assert summary["attendance_percentage"] == 80.0


def test_student_self_join_records_own_attendance_only(test_data):
    """Test that a student joining a session records their attendance without manipulating others."""
    sess = test_data["session"]
    st = test_data["students"][2]

    # Student 2 joins session using their own authenticated header
    res_join = client.post(
        f"/api/student/sessions/{sess.id}/join",
        headers={"X-Role": "student", "X-Student-Id": str(st.id), "X-User-Id": str(st.student_user_id)},
    )
    assert res_join.status_code == 200
    assert res_join.json()["status"] == "present"
    assert res_join.json()["student_id"] == st.id

    # Verify record in DB
    db = SessionLocal()
    att = (
        db.query(Attendance)
        .filter(Attendance.session_id == sess.id, Attendance.student_id == st.id)
        .first()
    )
    assert att is not None
    assert att.status == "present"
    assert att.attended_at is not None
    db.close()


def test_real_student_activity_database_attendance_flow():
    """
    CRITICAL VERIFICATION:
    1. Login as Student A (Alice Walker).
    2. Open specific Note/Test (Unit 1).
    3. Login as Student B (Bob Martin).
    4. Open/complete the same Test.
    5. Login as Teacher (Dr. Sarah Mitchell).
    6. Open Attendance.
    7. Click that exact Test.
    8. Confirm displayed count matches actual student actions (2/3 Present, 66.7%, 1 Absent).
    9. Confirm names match actual authenticated users.
    10. Confirm percentage is mathematically calculated from database records.
    11. Confirm separate attendance for a different Test (Unit 2).
    """
    db = SessionLocal()
    uid = uuid.uuid4().hex[:6]

    # 1. Real Teacher
    teacher = User(
        email=f"sarah.mitchell.{uid}@lessonfoundry.edu",
        name=f"Dr. Sarah Mitchell {uid}",
        role="teacher",
        join_code=f"SM{uid.upper()}",
    )
    db.add(teacher)
    db.flush()

    # 2. Real Students: Alice Walker (A), Bob Martin (B), Charlie Davis (C)
    students = []
    student_users = []
    names = [("Alice Walker", "alice"), ("Bob Martin", "bob"), ("Charlie Davis", "charlie")]
    for full_name, prefix in names:
        u = User(
            email=f"{prefix}.{uid}@lessonfoundry.edu",
            name=f"{full_name} {uid}",
            role="student",
        )
        db.add(u)
        db.flush()
        student_users.append(u)

        st = Student(
            student_user_id=u.id,
            name=u.name,
            email=u.email,
            class_label=f"Cloud-Class-{uid}",
            synthetic=False,
        )
        db.add(st)
        db.flush()
        students.append(st)

        # Enroll student with teacher
        enr = Enrollment(
            teacher_user_id=teacher.id,
            student_user_id=u.id,
        )
        db.add(enr)

    # 3. Two separate units: Unit 1 (Test 1) and Unit 2 (Test 2)
    source = db.query(Unit).first()
    source_id = source.source_id if source else 1
    unit1 = Unit(
        title=f"Cloud Computing Quiz 1 {uid}",
        source_id=source_id,
        target_grade="Grade 10",
        difficulty="Medium",
        status="published",
    )
    unit2 = Unit(
        title=f"Cybersecurity Fundamentals {uid}",
        source_id=source_id,
        target_grade="Grade 10",
        difficulty="Medium",
        status="published",
    )
    db.add_all([unit1, unit2])
    db.flush()

    sess1 = ClassSession(
        teacher_user_id=teacher.id,
        unit_id=unit1.id,
        title=unit1.title,
        class_label=f"Cloud-Class-{uid}",
        is_active=True,
    )
    sess2 = ClassSession(
        teacher_user_id=teacher.id,
        unit_id=unit2.id,
        title=unit2.title,
        class_label=f"Cloud-Class-{uid}",
        is_active=True,
    )
    db.add_all([sess1, sess2])
    db.commit()

    try:
        # Step A: Initial State - ZERO students have attended Unit 1 yet
        res_init = client.get(
            f"/api/teacher/sessions/{sess1.id}/attendance",
            headers={"X-Role": "teacher", "X-User-Id": str(teacher.id)},
        )
        assert res_init.status_code == 200
        data_init = res_init.json()
        assert data_init["total_students"] == 3
        assert data_init["present_count"] == 0
        assert data_init["absent_count"] == 3
        assert data_init["attendance_percentage"] == 0.0
        assert data_init["empty_state"] is True
        assert len(data_init["present_students"]) == 0
        assert len(data_init["absent_students"]) == 3
        assert students[0].name in data_init["absent_student_names"]
        assert students[1].name in data_init["absent_student_names"]
        assert students[2].name in data_init["absent_student_names"]

        # Step B: Student A (Alice) opens Unit 1
        res_alice = client.post(
            f"/api/student/units/{unit1.id}/activity",
            json={"unit_id": unit1.id, "activity_type": "opened_lesson"},
            headers={"X-Role": "student", "X-Student-Id": str(students[0].id), "X-User-Id": str(student_users[0].id)},
        )
        assert res_alice.status_code == 200
        assert res_alice.json()["status"] == "present"

        # Verify Teacher sees 1 / 3 Present, 33.3%, 2 Absent
        res_after_a = client.get(
            f"/api/teacher/sessions/{sess1.id}/attendance",
            headers={"X-Role": "teacher", "X-User-Id": str(teacher.id)},
        )
        data_a = res_after_a.json()
        assert data_a["total_students"] == 3
        assert data_a["present_count"] == 1
        assert data_a["absent_count"] == 2
        assert data_a["attendance_percentage"] == 33.3
        assert students[0].name in data_a["present_student_names"]
        assert students[1].name in data_a["absent_student_names"]
        assert students[2].name in data_a["absent_student_names"]

        # Step C: Student B (Bob) opens and completes Quiz 1
        res_bob = client.post(
            f"/api/student/units/{unit1.id}/activity",
            json={"unit_id": unit1.id, "activity_type": "completed_quiz"},
            headers={"X-Role": "student", "X-Student-Id": str(students[1].id), "X-User-Id": str(student_users[1].id)},
        )
        assert res_bob.status_code == 200

        # Verify Teacher sees 2 / 3 Present, 66.7%, 1 Absent
        res_after_b = client.get(
            f"/api/teacher/sessions/{sess1.id}/attendance",
            headers={"X-Role": "teacher", "X-User-Id": str(teacher.id)},
        )
        data_b = res_after_b.json()
        assert data_b["total_students"] == 3
        assert data_b["present_count"] == 2
        assert data_b["absent_count"] == 1
        assert data_b["attendance_percentage"] == 66.7
        assert students[0].name in data_b["present_student_names"]
        assert students[1].name in data_b["present_student_names"]
        assert students[2].name in data_b["absent_student_names"]

        # Step D: Confirm Student C (Charlie) never opened it -> NO attendance record
        att_c = db.query(Attendance).filter(Attendance.unit_id == unit1.id, Attendance.student_id == students[2].id).first()
        assert att_c is None

        # Step E: Confirm Unit 2 has 0 attendance records (Asset-Specific Tracking)
        res_unit2 = client.get(
            f"/api/teacher/sessions/{sess2.id}/attendance",
            headers={"X-Role": "teacher", "X-User-Id": str(teacher.id)},
        )
        data_u2 = res_unit2.json()
        assert data_u2["total_students"] == 3
        assert data_u2["present_count"] == 0
        assert data_u2["absent_count"] == 3
        assert data_u2["attendance_percentage"] == 0.0

    finally:
        # Teardown
        try:
            db.query(Attendance).filter(Attendance.session_id.in_([sess1.id, sess2.id])).delete()
            db.query(Attendance).filter(Attendance.unit_id.in_([unit1.id, unit2.id])).delete()
            db.query(ClassSession).filter(ClassSession.id.in_([sess1.id, sess2.id])).delete()
            db.query(Unit).filter(Unit.id.in_([unit1.id, unit2.id])).delete()
            for st in students:
                db.query(Enrollment).filter(Enrollment.student_user_id == st.student_user_id).delete()
                db.query(Student).filter(Student.id == st.id).delete()
            for u in student_users:
                db.query(User).filter(User.id == u.id).delete()
            db.query(User).filter(User.id == teacher.id).delete()
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
