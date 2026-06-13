from fastapi.testclient import TestClient

from app.main import app


def test_local_tts_health_placeholder() -> None:
    client = TestClient(app)

    response = client.get("/internal/local-tts/health", headers={"host": "127.0.0.1:17997"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["available"] is False


def test_local_tts_synthesize_placeholder_fails_safely() -> None:
    client = TestClient(app)

    response = client.post("/internal/local-tts/synthesize", headers={"host": "127.0.0.1:17997"}, json={"text": "네, 말씀하세요."})

    assert response.status_code >= 400
