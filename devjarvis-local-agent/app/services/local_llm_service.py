from app.core.config import get_settings
from app.schemas.local_llm import LocalLlmAnalyzeRequest, LocalLlmAnalyzeResponse, LocalLlmHealthResponse
from app.services.ollama_client import OllamaClient


class LocalLlmService:
    def __init__(self) -> None:
        self.client = OllamaClient(get_settings())

    async def health(self) -> LocalLlmHealthResponse:
        return await self.client.health()

    async def analyze(self, request: LocalLlmAnalyzeRequest) -> LocalLlmAnalyzeResponse:
        return await self.client.analyze(request)


def get_local_llm_service() -> LocalLlmService:
    return LocalLlmService()
