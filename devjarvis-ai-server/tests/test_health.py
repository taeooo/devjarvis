from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "UP"
    assert body["data"]["service"] == "devjarvis-ai-server"


def test_internal_health() -> None:
    client = TestClient(app)

    response = client.get("/internal/health")

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "UP"
