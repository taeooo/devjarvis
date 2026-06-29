from __future__ import annotations

from collections.abc import Awaitable, Callable

from app.graphs.jarvis_graph import JarvisGraphRunner
from app.schemas.local_llm import LocalLlmAnalyzeRequest, LocalLlmAnalyzeResponse

AnalyzeCallable = Callable[[LocalLlmAnalyzeRequest], Awaitable[LocalLlmAnalyzeResponse]]


class JarvisOrchestratorService:
    """Orchestrates local analysis without changing the public API schema."""

    def __init__(self, analyzer: AnalyzeCallable) -> None:
        self._runner = JarvisGraphRunner(analyzer)

    async def analyze(self, request: LocalLlmAnalyzeRequest) -> LocalLlmAnalyzeResponse:
        return await self._runner.run(request)
