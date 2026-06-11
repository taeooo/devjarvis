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
        json={"commandId": "cmd-1", "audio": None},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "unavailable"
    assert data["textReady"] is False
    assert data["text"] == ""


def test_local_stt_transcribe_rejects_non_audio_data_url() -> None:
    client = TestClient(app)

    response = client.post(
        "/internal/local-stt/transcribe",
        headers={"host": "127.0.0.1:17997"},
        json={
            "commandId": "cmd-1",
            "audio": {
                "dataUrl": "data:text/plain;base64,AAAA",
                "mimeType": "audio/wav",
                "byteSize": 4,
            },
        },
    )

    assert response.status_code in {400, 422}
