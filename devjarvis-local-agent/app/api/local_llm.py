from fastapi import APIRouter, Depends

from app.core.responses import ApiResponse
from app.schemas.local_llm import LocalLlmAnalyzeRequest, LocalLlmAnalyzeResponse, LocalLlmHealthResponse
from app.services.local_llm_service import LocalLlmService, get_local_llm_service

router = APIRouter(prefix="/internal/local-llm", tags=["local-llm"])


@router.get("/health", response_model=ApiResponse[LocalLlmHealthResponse])
async def local_llm_health(
    service: LocalLlmService = Depends(get_local_llm_service),
) -> ApiResponse[LocalLlmHealthResponse]:
    return ApiResponse.ok(await service.health())


@router.post("/analyze", response_model=ApiResponse[LocalLlmAnalyzeResponse])
async def analyze(
    request: LocalLlmAnalyzeRequest,
    service: LocalLlmService = Depends(get_local_llm_service),
) -> ApiResponse[LocalLlmAnalyzeResponse]:
    return ApiResponse.ok(await service.analyze(request))
