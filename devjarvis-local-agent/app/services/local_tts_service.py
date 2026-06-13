import subprocess
import tempfile
from pathlib import Path

from app.core.config import Settings, get_settings
from app.schemas.local_tts import LocalTtsHealthResponse


class LocalTtsService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def health(self) -> LocalTtsHealthResponse:
        if self.settings.tts_provider == "placeholder":
            return LocalTtsHealthResponse(available=False, warning="Local TTS model is not configured.")

        if self.settings.tts_provider == "piper_cli":
            if not self.settings.tts_model_path:
                return LocalTtsHealthResponse(available=False, warning="Local TTS model path is not configured.")
            model_path = Path(self.settings.tts_model_path)
            if not model_path.exists() or not model_path.is_file():
                return LocalTtsHealthResponse(available=False, warning="Local TTS model file was not found.")
            return LocalTtsHealthResponse(available=True, warning=None)

        return LocalTtsHealthResponse(available=False, warning="Local TTS provider is not available.")

    async def synthesize(self, text: str) -> bytes:
        normalized = normalize_tts_text(text, self.settings.tts_max_chars)
        if not normalized:
            raise RuntimeError("tts_text_empty")

        if self.settings.tts_provider != "piper_cli":
            raise RuntimeError("local_tts_provider_unavailable")

        health = await self.health()
        if not health.available:
            raise RuntimeError("local_tts_not_ready")

        return self._synthesize_with_piper_cli(normalized)

    def _synthesize_with_piper_cli(self, text: str) -> bytes:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            output_path = Path(temp_file.name)

        command = [
            self.settings.tts_piper_executable,
            "--model",
            self.settings.tts_model_path,
            "--output_file",
            str(output_path),
        ]
        if self.settings.tts_config_path:
            command.extend(["--config", self.settings.tts_config_path])

        try:
            subprocess.run(
                command,
                input=text,
                text=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=self.settings.tts_timeout_seconds,
                check=True,
            )
            return output_path.read_bytes()
        finally:
            try:
                output_path.unlink(missing_ok=True)
            except Exception:
                pass


def normalize_tts_text(value: str, max_chars: int) -> str:
    normalized = " ".join(value.replace("\n", " ").split())
    if len(normalized) > max_chars:
        normalized = normalized[:max_chars].strip() + "… 자세한 내용은 결과 창에서 확인해주세요."
    return normalized


def get_local_tts_service() -> LocalTtsService:
    return LocalTtsService()
