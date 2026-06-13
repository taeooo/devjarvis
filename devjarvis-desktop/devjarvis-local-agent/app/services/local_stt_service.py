import tempfile
from pathlib import Path
from typing import Any

from app.core.config import Settings, get_settings
from app.schemas.local_stt import LocalSttHealthResponse, LocalSttTranscribeResponse

ALLOWED_AUDIO_MIME_TYPES = {"audio/wav", "audio/webm", "audio/ogg", "audio/mpeg", "application/octet-stream"}

_STT_MODEL_CACHE: dict[tuple[str, str, str], Any] = {}


class LocalSttService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def health(self) -> LocalSttHealthResponse:
        if self.settings.stt_provider == "placeholder":
            return LocalSttHealthResponse(
                available=False,
                warning="Local STT model is not configured.",
            )

        if self.settings.stt_provider == "faster_whisper":
            try:
                import faster_whisper  # noqa: F401
            except Exception:
                return LocalSttHealthResponse(
                    available=False,
                    warning="Local STT runtime is not installed.",
                )
            return LocalSttHealthResponse(available=True, warning=None)

        return LocalSttHealthResponse(available=False, warning="Local STT provider is not available.")

    async def transcribe(
        self,
        *,
        audio_bytes: bytes,
        mime_type: str,
        filename: str,
        command_id: str | None = None,
        duration_millis: int | None = None,
        recorded_at: str | None = None,
    ) -> LocalSttTranscribeResponse:
        del command_id, duration_millis, recorded_at

        if not audio_bytes:
            return LocalSttTranscribeResponse(status="failed", warnings=["audio_empty"])

        if len(audio_bytes) > self.settings.stt_max_audio_bytes:
            return LocalSttTranscribeResponse(status="failed", warnings=["audio_too_large"])

        if mime_type not in ALLOWED_AUDIO_MIME_TYPES and not mime_type.startswith("audio/"):
            return LocalSttTranscribeResponse(status="failed", warnings=["unsupported_audio_type"])

        if self.settings.stt_provider == "placeholder":
            return LocalSttTranscribeResponse(
                status="unavailable",
                text="",
                textReady=False,
                warnings=["local_stt_placeholder_provider"],
            )

        if self.settings.stt_provider == "faster_whisper":
            return await self._transcribe_with_faster_whisper(audio_bytes, filename)

        return LocalSttTranscribeResponse(status="unavailable", warnings=["local_stt_provider_unavailable"])

    async def _transcribe_with_faster_whisper(self, audio_bytes: bytes, filename: str) -> LocalSttTranscribeResponse:
        try:
            from faster_whisper import WhisperModel
        except Exception:
            return LocalSttTranscribeResponse(status="unavailable", warnings=["faster_whisper_not_installed"])

        suffix = resolve_audio_suffix(filename)
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = Path(temp_file.name)

        try:
            model = self._get_faster_whisper_model(WhisperModel)
            segments, _info = model.transcribe(
                str(temp_path),
                language=self.settings.stt_language or None,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 450},
                beam_size=5,
                temperature=0,
                condition_on_previous_text=False,
                initial_prompt=self.settings.stt_initial_prompt,
            )
            text = " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
            normalized = normalize_common_stt_text(text)
            return LocalSttTranscribeResponse(
                status="completed",
                text=normalized,
                textReady=bool(normalized),
                warnings=[] if normalized else ["speech_not_detected"],
            )
        except Exception:
            return LocalSttTranscribeResponse(status="failed", warnings=["local_stt_transcription_failed"])
        finally:
            try:
                temp_path.unlink(missing_ok=True)
            except Exception:
                pass

    def _get_faster_whisper_model(self, model_cls: Any) -> Any:
        cache_key = (self.settings.stt_model, self.settings.stt_device, self.settings.stt_compute_type)
        if cache_key not in _STT_MODEL_CACHE:
            _STT_MODEL_CACHE[cache_key] = model_cls(
                self.settings.stt_model,
                device=self.settings.stt_device,
                compute_type=self.settings.stt_compute_type,
            )
        return _STT_MODEL_CACHE[cache_key]


def normalize_common_stt_text(text: str) -> str:
    normalized = " ".join(text.replace("\n", " ").split())
    replacements = {
        "해이 자비스": "헤이 자비스",
        "헤이 자비 스": "헤이 자비스",
        "하이 자비스": "헤이 자비스",
        "제비스": "자비스",
        "자 비스": "자비스",
        "더하기 더하기": "더하기",
        "플러스": "더하기",
        "마이너스": "빼기",
        "곱하기": "곱하기",
        "나누기": "나누기",
    }
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)
    return normalized.strip()


def resolve_audio_suffix(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".wav"):
        return ".wav"
    if lower.endswith(".ogg"):
        return ".ogg"
    if lower.endswith(".mp3"):
        return ".mp3"
    return ".webm"


def get_local_stt_service() -> LocalSttService:
    return LocalSttService()
