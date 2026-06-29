import importlib.util
import io
import sys
import tempfile
import wave
from pathlib import Path
from typing import Any

from app.core.config import Settings, get_settings
from app.schemas.local_tts import LocalTtsHealthResponse


class LocalTtsService:
    _melotts_model_cache: Any | None = None
    _melotts_speaker_id_cache: int | None = None
    _cosyvoice_model_cache: Any | None = None

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def health(self) -> LocalTtsHealthResponse:
        if self.settings.tts_provider == "placeholder":
            return LocalTtsHealthResponse(available=False, warning="Local TTS model is not configured.")

        if self.settings.tts_provider == "piper_cli":
            return self._piper_health()

        if self.settings.tts_provider == "melotts_kr":
            return self._melotts_health()

        if self.settings.tts_provider == "cosyvoice2_local":
            return self._cosyvoice2_health()

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
        elif self.settings.tts_provider == "cosyvoice2_local":
            audio = self._synthesize_with_cosyvoice2(normalized)
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

    def _cosyvoice2_health(self) -> LocalTtsHealthResponse:
        self._prepare_cosyvoice2_import_path()

        if importlib.util.find_spec("cosyvoice") is None:
            return LocalTtsHealthResponse(
                available=False,
                warning="cosyvoice2_runtime_missing",
            )

        model_dir = Path(self.settings.tts_cosyvoice_model_dir)
        if not self.settings.tts_cosyvoice_model_dir or not model_dir.exists() or not model_dir.is_dir():
            return LocalTtsHealthResponse(available=False, warning="cosyvoice2_model_dir_missing")

        prompt_audio = Path(self.settings.tts_cosyvoice_prompt_audio_path)
        if not self.settings.tts_cosyvoice_prompt_audio_path or not prompt_audio.exists() or not prompt_audio.is_file():
            return LocalTtsHealthResponse(available=False, warning="cosyvoice2_reference_wav_missing")

        prompt_text = self._resolve_cosyvoice2_prompt_text()
        if not prompt_text:
            return LocalTtsHealthResponse(available=False, warning="cosyvoice2_reference_text_missing")

        audio_warning = validate_reference_wav(prompt_audio)
        if audio_warning:
            return LocalTtsHealthResponse(available=False, warning=audio_warning)

        return LocalTtsHealthResponse(available=True, warning=None)

    def _synthesize_with_piper_cli(self, text: str) -> bytes:
        import subprocess

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

    def _synthesize_with_cosyvoice2(self, text: str) -> bytes:
        model = self._get_cosyvoice2_model()
        prompt_text = self._resolve_cosyvoice2_prompt_text()
        prompt_audio_path = self.settings.tts_cosyvoice_prompt_audio_path

        if not prompt_text:
            raise RuntimeError("cosyvoice2_reference_text_missing")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            output_path = Path(temp_file.name)

        try:
            import torch  # type: ignore[import-not-found]
            import torchaudio  # type: ignore[import-not-found]
            from cosyvoice.utils.file_utils import load_wav  # type: ignore[import-not-found]

            prompt_speech_16k = load_wav(prompt_audio_path, 16000)

            try:
                iterator = model.inference_zero_shot(
                    text,
                    prompt_text,
                    prompt_speech_16k,
                    stream=False,
                    text_frontend=self.settings.tts_cosyvoice_text_frontend,
                )
            except TypeError:
                iterator = model.inference_zero_shot(
                    text,
                    prompt_text,
                    prompt_speech_16k,
                    stream=False,
                )

            chunks = []
            for item in iterator:
                speech = item.get("tts_speech") if isinstance(item, dict) else None
                if speech is not None:
                    chunks.append(speech)

            if not chunks:
                raise RuntimeError("cosyvoice2_no_audio")

            audio_tensor = torch.cat(chunks, dim=1) if len(chunks) > 1 else chunks[0]
            sample_rate = int(getattr(model, "sample_rate", 24000))
            torchaudio.save(str(output_path), audio_tensor.cpu(), sample_rate)
            return output_path.read_bytes()
        except Exception as exc:
            raise RuntimeError("cosyvoice2_synthesis_failed") from exc
        finally:
            try:
                output_path.unlink(missing_ok=True)
            except Exception:
                pass

    def _get_cosyvoice2_model(self) -> Any:
        if LocalTtsService._cosyvoice_model_cache is not None:
            return LocalTtsService._cosyvoice_model_cache

        self._prepare_cosyvoice2_import_path()

        from cosyvoice.cli.cosyvoice import CosyVoice2  # type: ignore[import-not-found]

        try:
            model = CosyVoice2(
                self.settings.tts_cosyvoice_model_dir,
                load_jit=False,
                load_trt=False,
                fp16=False,
            )
        except TypeError:
            model = CosyVoice2(self.settings.tts_cosyvoice_model_dir)
        LocalTtsService._cosyvoice_model_cache = model
        return model

    def _resolve_cosyvoice2_prompt_text(self) -> str:
        direct = self.settings.tts_cosyvoice_prompt_text.strip()
        if direct and direct != "REFERENCE_WAV_TRANSCRIPT_HERE":
            return direct

        candidates: list[Path] = []
        if self.settings.tts_cosyvoice_prompt_text_path.strip():
            candidates.append(Path(self.settings.tts_cosyvoice_prompt_text_path))
        if self.settings.tts_cosyvoice_prompt_audio_path.strip():
            candidates.append(Path(self.settings.tts_cosyvoice_prompt_audio_path).with_suffix(".txt"))

        for candidate in candidates:
            if not candidate.exists() or not candidate.is_file():
                continue
            try:
                value = candidate.read_text(encoding="utf-8-sig").strip()
            except UnicodeDecodeError:
                value = candidate.read_text(encoding="cp949").strip()
            if value:
                return " ".join(value.split())
        return ""

    def _prepare_cosyvoice2_import_path(self) -> None:
        repo_path = self._resolve_optional_dir(self.settings.tts_cosyvoice_repo_path)
        if repo_path is None:
            return
        matcha_path = repo_path / "third_party" / "Matcha-TTS"
        for path in [repo_path, matcha_path]:
            if path.exists() and str(path) not in sys.path:
                sys.path.insert(0, str(path))

    @staticmethod
    def _resolve_optional_dir(value: str) -> Path | None:
        if not value.strip():
            return None
        path = Path(value)
        return path if path.exists() and path.is_dir() else None


def normalize_tts_text(value: str, max_chars: int) -> str:
    normalized = " ".join(value.replace("\n", " ").split())
    normalized = stabilize_short_assistant_utterance(normalized)
    if len(normalized) > max_chars:
        normalized = normalized[:max_chars].strip() + "… 자세한 내용은 결과 창에서 확인해 주세요."
    return normalized


def stabilize_short_assistant_utterance(value: str) -> str:
    if value in {"네, 말씀하세요.", "네. 말씀하세요."}:
        return "네. 듣고 있습니다."
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


def validate_reference_wav(path: Path) -> str | None:
    try:
        with wave.open(str(path), "rb") as reader:
            channels = reader.getnchannels()
            framerate = reader.getframerate()
            frames = reader.getnframes()
            duration = frames / framerate if framerate else 0
    except Exception:
        return "cosyvoice2_reference_wav_invalid"

    if channels != 1:
        return "cosyvoice2_reference_wav_must_be_mono"
    if framerate != 16000:
        return "cosyvoice2_reference_wav_must_be_16khz"
    if duration < 3:
        return "cosyvoice2_reference_wav_too_short"
    if duration > 20:
        return "cosyvoice2_reference_wav_too_long"
    return None


def get_local_tts_service() -> LocalTtsService:
    return LocalTtsService()
