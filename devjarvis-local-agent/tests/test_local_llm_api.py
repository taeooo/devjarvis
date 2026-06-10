from fastapi.testclient import TestClient

from app.api.local_llm import get_local_llm_service
from app.main import app
from app.schemas.local_llm import LocalLlmAnalyzeRequest, LocalLlmAnalyzeResponse, LocalLlmHealthResponse


class StubLocalLlmService:
    async def health(self) -> LocalLlmHealthResponse:
        return LocalLlmHealthResponse(available=True, model="stub", baseUrl="http://127.0.0.1:11434")

    async def analyze(self, request: LocalLlmAnalyzeRequest) -> LocalLlmAnalyzeResponse:
        return LocalLlmAnalyzeResponse(
            status="completed",
            model="stub",
            intent=request.intent,
            summary="ok",
            actionItems=["check next step"],
        )


def test_local_llm_health() -> None:
    app.dependency_overrides[get_local_llm_service] = lambda: StubLocalLlmService()
    client = TestClient(app)

    response = client.get("/internal/local-llm/health", headers={"host": "127.0.0.1:17997"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["data"]["available"] is True


def test_local_llm_analyze() -> None:
    app.dependency_overrides[get_local_llm_service] = lambda: StubLocalLlmService()
    client = TestClient(app)

    response = client.post(
        "/internal/local-llm/analyze",
        headers={"host": "127.0.0.1:17997"},
        json={"intent": "screen_summary", "text": "hello"},
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["data"]["summary"] == "ok"
