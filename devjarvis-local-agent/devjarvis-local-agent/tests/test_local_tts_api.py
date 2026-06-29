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


def test_tts_settings_accepts_melotts_provider() -> None:
    from app.core.config import Settings

    settings = Settings(tts_provider="melotts_kr", _env_file=None)

    assert settings.tts_provider == "melotts_kr"
    assert settings.tts_melotts_device == "cpu"


def test_tts_normalizes_short_acknowledgement_for_cleaner_playback() -> None:
    from app.services.local_tts_service import normalize_tts_text

    assert normalize_tts_text("네, 말씀하세요.", 100) == "네. 듣고 있습니다."


def test_tts_prepends_silence_to_wav() -> None:
    import io
    import wave

    from app.services.local_tts_service import prepend_wav_silence

    source = io.BytesIO()
    with wave.open(source, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(16000)
        writer.writeframes(b"\x01\x02" * 160)

    with_silence = prepend_wav_silence(source.getvalue(), 100)

    with wave.open(io.BytesIO(with_silence), "rb") as reader:
        assert reader.getnframes() > 160
        first_frames = reader.readframes(1600)
        assert first_frames.startswith(b"\x00\x00" * 10)


def test_tts_settings_accepts_cosyvoice2_provider() -> None:
    from app.core.config import Settings

    settings = Settings(tts_provider="cosyvoice2_local", _env_file=None)

    assert settings.tts_provider == "cosyvoice2_local"
    assert settings.tts_cosyvoice_model_dir == ""


def test_cosyvoice2_health_requires_local_reference_voice() -> None:
    from app.core.config import Settings
    from app.services.local_tts_service import LocalTtsService

    service = LocalTtsService(Settings(tts_provider="cosyvoice2_local", _env_file=None))
    health = service._cosyvoice2_health()

    assert health.available is False
    assert health.warning is not None
