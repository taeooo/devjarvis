from fastapi.testclient import TestClient

from app.api.local_llm import get_local_llm_service
from app.main import app
from app.schemas.local_llm import LocalLlmAnalyzeRequest, LocalLlmAnalyzeResponse, LocalLlmHealthResponse


class StubLocalLlmService:
    async def health(self) -> LocalLlmHealthResponse:
        return LocalLlmHealthResponse(available=True)

    async def analyze(self, request: LocalLlmAnalyzeRequest) -> LocalLlmAnalyzeResponse:
        return LocalLlmAnalyzeResponse(
            status="completed",
            summary="ok",
            actionItems=["check next step"],
        )


def test_local_llm_health_returns_minimal_readiness() -> None:
    app.dependency_overrides[get_local_llm_service] = lambda: StubLocalLlmService()
    client = TestClient(app)

    response = client.get("/internal/local-llm/health", headers={"host": "127.0.0.1:17997"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["available"] is True
    assert "provider" not in data
    assert "model" not in data
    assert "modelRouting" not in data
    assert "baseUrl" not in data


def test_local_llm_analyze_returns_no_model_details() -> None:
    app.dependency_overrides[get_local_llm_service] = lambda: StubLocalLlmService()
    client = TestClient(app)

    response = client.post(
        "/internal/local-llm/analyze",
        headers={"host": "127.0.0.1:17997"},
        json={"intent": "screen_summary", "text": "hello"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["summary"] == "ok"
    assert "provider" not in data
    assert "model" not in data
    assert "modelRole" not in data
    assert "intent" not in data
