from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.core.responses import ApiResponse
from app.schemas.local_stt import LocalSttHealthResponse, LocalSttTranscribeResponse
from app.services.local_stt_service import LocalSttService, get_local_stt_service

router = APIRouter(prefix="/internal/local-stt", tags=["local-stt"])


@router.get("/health", response_model=ApiResponse[LocalSttHealthResponse])
async def local_stt_health(
    service: LocalSttService = Depends(get_local_stt_service),
) -> ApiResponse[LocalSttHealthResponse]:
    return ApiResponse.ok(await service.health())


@router.post("/transcribe", response_model=ApiResponse[LocalSttTranscribeResponse])
async def transcribe(
    audio: UploadFile = File(...),
    commandId: str | None = Form(default=None),
    durationMillis: int | None = Form(default=None),
    recordedAt: str | None = Form(default=None),
    purpose: str | None = Form(default=None),
    service: LocalSttService = Depends(get_local_stt_service),
) -> ApiResponse[LocalSttTranscribeResponse]:
    audio_bytes = await audio.read()
    return ApiResponse.ok(
        await service.transcribe(
            audio_bytes=audio_bytes,
            mime_type=audio.content_type or "application/octet-stream",
            filename=audio.filename or "voice.webm",
            command_id=commandId,
            duration_millis=durationMillis,
            recorded_at=recordedAt,
            purpose=purpose,
        )
    )
