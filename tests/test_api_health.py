from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "LessonFoundry"


def test_role_dependency_defaults():
    # Teacher route with default X-Role (teacher)
    response = client.get("/api/sources/1/versions")
    assert response.status_code == 200

    # Student accessing teacher route gets 403
    response = client.get("/api/sources/1/versions", headers={"X-Role": "student"})
    assert response.status_code == 403

    # Student route with student role
    response = client.get("/api/student/units", headers={"X-Role": "student"})
    assert response.status_code == 200

    # Teacher accessing student route gets 403
    response = client.get("/api/student/units", headers={"X-Role": "teacher"})
    assert response.status_code == 403
