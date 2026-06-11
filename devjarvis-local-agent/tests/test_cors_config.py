from app.core.config import Settings


def test_local_agent_cors_allows_tauri_and_dev_origins_only() -> None:
    settings = Settings(_env_file=None)

    assert "http://tauri.localhost" in settings.cors_allow_origins
    assert "https://tauri.localhost" in settings.cors_allow_origins
    assert "tauri://localhost" in settings.cors_allow_origins
    assert "http://localhost:1420" in settings.cors_allow_origins
    assert "http://127.0.0.1:1420" in settings.cors_allow_origins
    assert "http://localhost:5173" in settings.cors_allow_origins
    assert "http://127.0.0.1:5173" in settings.cors_allow_origins
    assert "*" not in settings.cors_allow_origins
