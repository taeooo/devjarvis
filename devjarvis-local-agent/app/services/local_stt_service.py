from app.core.config import Settings, get_settings
from app.schemas.local_stt import LocalSttHealthResponse, LocalSttTranscribeRequest, LocalSttTranscribeResponse


class LocalSttService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def health(self) -> LocalSttHealthResponse:
        return LocalSttHealthResponse(
            available=False,
            warning="Local STT model is not configured.",
        )

    async def transcribe(self, request: LocalSttTranscribeRequest) -> LocalSttTranscribeResponse:
        if request.audio and request.audio.byteSize > self.settings.stt_max_audio_bytes:
            return LocalSttTranscribeResponse(
                status="failed",
                warnings=["audio_too_large"],
            )

        return LocalSttTranscribeResponse(
            status="unavailable",
            text="",
            textReady=False,
            warnings=["local_stt_placeholder_provider"],
        )


def get_local_stt_service() -> LocalSttService:
    return LocalSttService()
