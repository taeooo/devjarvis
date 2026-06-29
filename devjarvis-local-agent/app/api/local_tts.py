from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.responses import ApiResponse
from app.schemas.local_tts import LocalTtsHealthResponse, LocalTtsSynthesizeRequest
from app.services.local_tts_service import LocalTtsService, get_local_tts_service

router = APIRouter(prefix="/internal/local-tts", tags=["local-tts"])


@router.get("/health", response_model=ApiResponse[LocalTtsHealthResponse])
async def local_tts_health(
    service: LocalTtsService = Depends(get_local_tts_service),
) -> ApiResponse[LocalTtsHealthResponse]:
    return ApiResponse.ok(await service.health())


@router.post("/synthesize")
async def synthesize(
    request: LocalTtsSynthesizeRequest,
    service: LocalTtsService = Depends(get_local_tts_service),
) -> Response:
    try:
        audio = await service.synthesize(request.text)
    except Exception as exc:
        detail = str(exc) or "local_tts_unavailable"
        if "cosyvoice2" not in detail and "melotts" not in detail and "piper" not in detail:
            detail = "local_tts_unavailable"
        raise HTTPException(status_code=503, detail=detail) from exc
    return Response(content=audio, media_type="audio/wav")
