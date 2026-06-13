from fastapi.testclient import TestClient

from app.main import app


def test_local_stt_health_returns_minimal_readiness() -> None:
    client = TestClient(app)

    response = client.get("/internal/local-stt/health", headers={"host": "127.0.0.1:17997"})

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["available"] is False
    assert "provider" not in data
    assert "model" not in data
    assert data["maxAudioBytes"] > 0
    assert data["maxDurationMillis"] > 0
    assert "audio/webm" in data["acceptedMimeTypes"]


def test_local_stt_transcribe_placeholder_returns_no_text() -> None:
    client = TestClient(app)

    response = client.post(
        "/internal/local-stt/transcribe",
        headers={"host": "127.0.0.1:17997"},
        files={"audio": ("voice-command.webm", b"fake-audio", "audio/webm")},
        data={"commandId": "cmd-1", "durationMillis": "1200"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "unavailable"
    assert data["textReady"] is False
    assert data["text"] == ""


def test_local_stt_transcribe_requires_audio_file() -> None:
    client = TestClient(app)

    response = client.post(
        "/internal/local-stt/transcribe",
        headers={"host": "127.0.0.1:17997"},
        data={"commandId": "cmd-1"},
    )

    assert response.status_code in {400, 422}
