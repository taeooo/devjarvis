from fastapi import APIRouter, Depends

from app.core.responses import ApiResponse
from app.schemas.local_stt import LocalSttHealthResponse, LocalSttTranscribeRequest, LocalSttTranscribeResponse
from app.services.local_stt_service import LocalSttService, get_local_stt_service

router = APIRouter(prefix="/internal/local-stt", tags=["local-stt"])


@router.get("/health", response_model=ApiResponse[LocalSttHealthResponse])
async def local_stt_health(
    service: LocalSttService = Depends(get_local_stt_service),
) -> ApiResponse[LocalSttHealthResponse]:
    return ApiResponse.ok(await service.health())


@router.post("/transcribe", response_model=ApiResponse[LocalSttTranscribeResponse])
async def transcribe(
    request: LocalSttTranscribeRequest,
    service: LocalSttService = Depends(get_local_stt_service),
) -> ApiResponse[LocalSttTranscribeResponse]:
    return ApiResponse.ok(await service.transcribe(request))
