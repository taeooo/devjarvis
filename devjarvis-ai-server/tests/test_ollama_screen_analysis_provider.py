from app.schemas.screen_analysis import ScreenAnalysisRequest
from app.screen_analysis.ollama_provider import OllamaScreenAnalysisProvider


class FakeResponse:
    def raise_for_status(self) -> None:
        return None

    def json(self):
        return {
            "message": {
                "content": '{"title":"화면 요약","summary":"오류가 보입니다.","detail":"fastapi 모듈 누락 가능성이 있습니다.","actionItems":["의존성 설치 여부를 확인하세요."]}'
            }
        }


class FakeClient:
    def __init__(self) -> None:
        self.payload = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def post(self, _url: str, json):
        self.payload = json
        return FakeResponse()


def _request() -> ScreenAnalysisRequest:
    return ScreenAnalysisRequest(
        requestId="req-analysis-ollama",
        commandId="cmd-analysis-ollama",
        intent="screen_error_analysis",
        contextMode="screen",
        ocrProvider="rapidocr",
        ocrText="ModuleNotFoundError: No module named fastapi",
        ocrTextFound=True,
        width=1280,
        height=720,
        capturedAt="2026-06-10T00:00:00Z",
    )


def test_ollama_provider_parses_json_response() -> None:
    fake_client = FakeClient()
    provider = OllamaScreenAnalysisProvider(
        base_url="http://localhost:11434",
        model="local-model",
        timeout_seconds=1,
        temperature=0.1,
        client_factory=lambda _timeout: fake_client,
    )

    response = provider.analyze(_request(), "ModuleNotFoundError: No module named fastapi", [])

    assert response.provider == "ollama-screen-analysis"
    assert response.status == "completed"
    assert response.title == "화면 요약"
    assert response.action_items == ["의존성 설치 여부를 확인하세요."]
    assert fake_client.payload["model"] == "local-model"
    assert fake_client.payload["stream"] is False
    assert fake_client.payload["format"] == "json"


def test_ollama_provider_fails_safely_when_model_missing() -> None:
    provider = OllamaScreenAnalysisProvider(
        base_url="http://localhost:11434",
        model="",
        timeout_seconds=1,
        temperature=0.1,
        client_factory=lambda _timeout: FakeClient(),
    )

    response = provider.analyze(_request(), "hello", [])

    assert response.status == "failed"
    assert response.warnings
