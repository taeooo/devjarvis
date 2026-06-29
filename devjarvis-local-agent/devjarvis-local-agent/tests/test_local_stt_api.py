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


def test_local_stt_transcribe_placeholder_returns_no_text() -> None:
    client = TestClient(app)

    response = client.post(
        "/internal/local-stt/transcribe",
        headers={"host": "127.0.0.1:17997"},
        files={"audio": ("voice.webm", b"fake-audio", "audio/webm")},
        data={"commandId": "cmd-1", "durationMillis": "1000"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "unavailable"
    assert data["textReady"] is False
    assert data["text"] == ""


def test_local_stt_transcribe_rejects_non_audio_payload() -> None:
    client = TestClient(app)

    response = client.post(
        "/internal/local-stt/transcribe",
        headers={"host": "127.0.0.1:17997"},
        files={"audio": ("voice.txt", b"not-audio", "text/plain")},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "failed"
    assert "unsupported_audio_type" in data["warnings"]


def test_stt_normalizes_common_wake_and_math_words() -> None:
    from app.services.local_stt_service import normalize_common_stt_text

    text = normalize_common_stt_text("하이 자비스 사 더하기 사")

    assert "헤이 자비스" in text
    assert "사 더하기 사" in text
