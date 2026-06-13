from fastapi.testclient import TestClient

from app.main import app


def test_local_wake_health_placeholder():
    client = TestClient(app)
    response = client.get("/internal/local-wake/health", headers={"host": "127.0.0.1:17997"})

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    data = body["data"]
    assert data["available"] is False
    assert data["listening"] is False
    assert data["phraseHint"]


def test_local_wake_start_placeholder_returns_unavailable():
    client = TestClient(app)
    response = client.post("/internal/local-wake/session/start", headers={"host": "127.0.0.1:17997"})

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "unavailable"


def test_local_wake_stop_is_idempotent():
    client = TestClient(app)
    response = client.post("/internal/local-wake/session/stop", headers={"host": "127.0.0.1:17997"})

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "stopped"
