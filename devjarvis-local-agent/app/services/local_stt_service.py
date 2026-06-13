from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

from app.core.config import Settings, get_settings
from app.schemas.local_stt import LocalSttHealthResponse, LocalSttTranscribeResponse

ACCEPTED_MIME_TYPES = [
    "audio/webm",
    "audio/ogg",
    "audio/wav",
    "audio/mpeg",
]


class LocalSttService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def health(self) -> LocalSttHealthResponse:
        available = self.settings.stt_provider == "faster_whisper"
        return LocalSttHealthResponse(
            available=available,
            warning=None if available else "Local STT is not configured.",
            maxAudioBytes=self.settings.stt_max_audio_bytes,
            maxDurationMillis=self.settings.stt_max_duration_millis,
            acceptedMimeTypes=ACCEPTED_MIME_TYPES,
        )

    async def transcribe(
        self,
        audio_bytes: bytes,
        mime_type: str,
        duration_millis: int | None = None,
    ) -> LocalSttTranscribeResponse:
        warnings: list[str] = []

        if self.settings.stt_provider != "faster_whisper":
            return LocalSttTranscribeResponse(
                status="unavailable",
                textReady=False,
                warnings=["local_stt_not_configured"],
            )

        normalized_mime_type = mime_type.split(";", 1)[0].strip().lower()
        if normalized_mime_type not in ACCEPTED_MIME_TYPES:
            return LocalSttTranscribeResponse(
                status="failed",
                textReady=False,
                durationMillis=duration_millis,
                warnings=["unsupported_audio_type"],
            )

        if len(audio_bytes) > self.settings.stt_max_audio_bytes:
            return LocalSttTranscribeResponse(
                status="failed",
                textReady=False,
                durationMillis=duration_millis,
                warnings=["audio_too_large"],
            )

        if duration_millis is not None and duration_millis > self.settings.stt_max_duration_millis:
            return LocalSttTranscribeResponse(
                status="failed",
                textReady=False,
                durationMillis=duration_millis,
                warnings=["audio_too_long"],
            )

        try:
            text = await self._transcribe_with_faster_whisper(audio_bytes, normalized_mime_type)
        except ModuleNotFoundError:
            return LocalSttTranscribeResponse(
                status="unavailable",
                textReady=False,
                durationMillis=duration_millis,
                warnings=["local_stt_runtime_missing"],
            )
        except Exception:
            return LocalSttTranscribeResponse(
                status="failed",
                textReady=False,
                durationMillis=duration_millis,
                warnings=["local_stt_transcription_failed"],
            )

        stripped = text.strip()
        if not stripped:
            warnings.append("empty_transcription")

        return LocalSttTranscribeResponse(
            status="completed" if stripped else "failed",
            text=stripped,
            textReady=bool(stripped),
            durationMillis=duration_millis,
            warnings=warnings,
        )

    async def _transcribe_with_faster_whisper(self, audio_bytes: bytes, mime_type: str) -> str:
        from faster_whisper import WhisperModel

        suffix = resolve_audio_suffix(mime_type)
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary_file:
            temporary_file.write(audio_bytes)
            temporary_path = Path(temporary_file.name)

        try:
            model = WhisperModel(
                self.settings.stt_model,
                device=self.settings.stt_device,
                compute_type=self.settings.stt_compute_type,
            )
            segments, _info = model.transcribe(
                str(temporary_path),
                language=self.settings.stt_language or None,
                vad_filter=True,
            )
            return " ".join(segment.text.strip() for segment in segments if getattr(segment, "text", "").strip())
        finally:
            temporary_path.unlink(missing_ok=True)


def resolve_audio_suffix(mime_type: str) -> str:
    if mime_type == "audio/ogg":
        return ".ogg"
    if mime_type == "audio/wav":
        return ".wav"
    if mime_type == "audio/mpeg":
        return ".mp3"
    return ".webm"


def get_local_stt_service() -> LocalSttService:
    return LocalSttService()
