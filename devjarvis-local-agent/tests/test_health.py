from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_minimal_local_status() -> None:
    client = TestClient(app)
    response = client.get("/health", headers={"host": "127.0.0.1:17997"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    data = payload["data"]
    assert data["status"] == "UP"
    assert data["loopbackOnly"] is True
    assert "service" not in data
    assert "version" not in data
