from app.core.config import get_settings
from app.schemas.local_llm import LocalLlmAnalyzeRequest, LocalLlmAnalyzeResponse, LocalLlmHealthResponse
from app.services.jarvis_orchestrator_service import JarvisOrchestratorService
from app.services.math_solver import solve_arithmetic_text
from app.services.ollama_client import OllamaClient


class LocalLlmService:
    def __init__(self) -> None:
        self.client = OllamaClient(get_settings())
        self.orchestrator = JarvisOrchestratorService(self._analyze_with_existing_flow)

    async def health(self) -> LocalLlmHealthResponse:
        return await self.client.health()

    async def analyze(self, request: LocalLlmAnalyzeRequest) -> LocalLlmAnalyzeResponse:
        return await self.orchestrator.analyze(request)

    async def _analyze_with_existing_flow(self, request: LocalLlmAnalyzeRequest) -> LocalLlmAnalyzeResponse:
        if request.intent == "screen_math_solver":
            deterministic_response = solve_arithmetic_text(request.text, context=request.context)
            if deterministic_response is not None:
                return deterministic_response

        return await self.client.analyze(request)


def get_local_llm_service() -> LocalLlmService:
    return LocalLlmService()
