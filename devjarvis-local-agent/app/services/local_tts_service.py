import importlib.util
import io
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Any

from app.core.config import Settings, get_settings
from app.schemas.local_tts import LocalTtsHealthResponse


class LocalTtsService:
    _melotts_model_cache: Any | None = None
    _melotts_speaker_id_cache: int | None = None

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def health(self) -> LocalTtsHealthResponse:
        if self.settings.tts_provider == "placeholder":
            return LocalTtsHealthResponse(available=False, warning="Local TTS model is not configured.")

        if self.settings.tts_provider == "piper_cli":
            return self._piper_health()

        if self.settings.tts_provider == "melotts_kr":
            return self._melotts_health()

        return LocalTtsHealthResponse(available=False, warning="Local TTS provider is not available.")

    async def synthesize(self, text: str) -> bytes:
        normalized = normalize_tts_text(text, self.settings.tts_max_chars)
        if not normalized:
            raise RuntimeError("tts_text_empty")

        health = await self.health()
        if not health.available:
            raise RuntimeError("local_tts_not_ready")

        if self.settings.tts_provider == "piper_cli":
            audio = self._synthesize_with_piper_cli(normalized)
        elif self.settings.tts_provider == "melotts_kr":
            audio = self._synthesize_with_melotts_kr(normalized)
        else:
            raise RuntimeError("local_tts_provider_unavailable")

        return prepend_wav_silence(audio, self.settings.tts_leading_silence_millis)

    def _piper_health(self) -> LocalTtsHealthResponse:
        if not self.settings.tts_model_path:
            return LocalTtsHealthResponse(available=False, warning="Local TTS model path is not configured.")
        model_path = Path(self.settings.tts_model_path)
        if not model_path.exists() or not model_path.is_file():
            return LocalTtsHealthResponse(available=False, warning="Local TTS model file was not found.")
        executable = Path(self.settings.tts_piper_executable)
        if self.settings.tts_piper_executable and not executable.exists() and "/" in self.settings.tts_piper_executable.replace("\\", "/"):
            return LocalTtsHealthResponse(available=False, warning="Local TTS executable was not found.")
        return LocalTtsHealthResponse(available=True, warning=None)

    def _melotts_health(self) -> LocalTtsHealthResponse:
        if importlib.util.find_spec("melo") is None:
            return LocalTtsHealthResponse(
                available=False,
                warning="MeloTTS runtime is not installed. Run the optional local TTS setup first.",
            )
        return LocalTtsHealthResponse(available=True, warning=None)

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

    def _synthesize_with_melotts_kr(self, text: str) -> bytes:
        model, speaker_id = self._get_melotts_model()
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            output_path = Path(temp_file.name)

        try:
            model.tts_to_file(
                text,
                speaker_id,
                str(output_path),
                speed=self.settings.tts_melotts_speed,
            )
            return output_path.read_bytes()
        finally:
            try:
                output_path.unlink(missing_ok=True)
            except Exception:
                pass

    def _get_melotts_model(self) -> tuple[Any, int]:
        if LocalTtsService._melotts_model_cache is not None and LocalTtsService._melotts_speaker_id_cache is not None:
            return LocalTtsService._melotts_model_cache, LocalTtsService._melotts_speaker_id_cache

        from melo.api import TTS  # type: ignore[import-not-found]

        model = TTS(language="KR", device=self.settings.tts_melotts_device)
        speaker_ids = getattr(model.hps.data, "spk2id", {})
        speaker_key = self.settings.tts_melotts_speaker_id or "KR"
        speaker_id = speaker_ids.get(speaker_key) or speaker_ids.get("KR")
        if speaker_id is None:
            raise RuntimeError("melotts_korean_speaker_not_found")

        LocalTtsService._melotts_model_cache = model
        LocalTtsService._melotts_speaker_id_cache = int(speaker_id)
        return model, int(speaker_id)


def normalize_tts_text(value: str, max_chars: int) -> str:
    normalized = " ".join(value.replace("\n", " ").split())
    normalized = stabilize_short_assistant_utterance(normalized)
    if len(normalized) > max_chars:
        normalized = normalized[:max_chars].strip() + "… 자세한 내용은 결과 창에서 확인해주세요."
    return normalized


def stabilize_short_assistant_utterance(value: str) -> str:
    if value == "네, 말씀하세요.":
        return "네. 말씀하세요."
    if value.startswith("네, "):
        return value.replace("네, ", "네. ", 1)
    return value


def prepend_wav_silence(audio: bytes, silence_millis: int) -> bytes:
    if silence_millis <= 0 or len(audio) < 44:
        return audio

    try:
        with wave.open(io.BytesIO(audio), "rb") as reader:
            params = reader.getparams()
            frames = reader.readframes(reader.getnframes())

        silence_frames = int(params.framerate * silence_millis / 1000)
        if silence_frames <= 0:
            return audio

        silence = b"\x00" * silence_frames * params.nchannels * params.sampwidth
        output = io.BytesIO()
        with wave.open(output, "wb") as writer:
            writer.setparams(params)
            writer.writeframes(silence + frames)
        return output.getvalue()
    except Exception:
        return audio


def get_local_tts_service() -> LocalTtsService:
    return LocalTtsService()
