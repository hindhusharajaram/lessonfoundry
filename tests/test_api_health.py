from fastapi.testclient import TestClient
from api.main import app
from db.database import SessionLocal
from db.models import Source

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "LessonFoundry"


def test_role_dependency_defaults():
    # Create a source so /api/sources/{id}/versions exists
    session = SessionLocal()
    src = Source(title="Auth Test Source", filename="test.txt")
    session.add(src)
    session.commit()
    src_id = src.id
    session.close()

    # Teacher route with default X-Role (teacher) -> succeeds (200)
    response = client.get(f"/api/sources/{src_id}/versions")
    assert response.status_code == 200

    # Student accessing teacher route gets 403 Forbidden
    response = client.get(f"/api/sources/{src_id}/versions", headers={"X-Role": "student"})
    assert response.status_code == 403

    # Student route with student role -> succeeds (200)
    response = client.get("/api/student/units", headers={"X-Role": "student"})
    assert response.status_code == 200

    # Teacher accessing student route gets 403 Forbidden
    response = client.get("/api/student/units", headers={"X-Role": "teacher"})
    assert response.status_code == 403
