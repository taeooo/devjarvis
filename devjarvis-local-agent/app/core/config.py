from functools import lru_cache
from ipaddress import ip_address

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="DEVJARVIS_LOCAL_AGENT_",
        extra="ignore",
    )

    env: str = Field(default="local")
    app_name: str = Field(default="devjarvis-local-agent")
    app_version: str = Field(default="0.1.0")
    host: str = Field(default="127.0.0.1")
    port: int = Field(default=17997)
    enable_docs: bool = Field(default=True)
    require_loopback: bool = Field(default=True)

    ollama_base_url: str = Field(default="http://127.0.0.1:11434")
    # Backward-compatible single model setting. Prefer the intent-specific model settings below.
    ollama_model: str = Field(default="")
    default_model: str = Field(default="")
    code_model: str = Field(default="")
    translation_model: str = Field(default="")
    reasoning_model: str = Field(default="")
    fallback_model: str = Field(default="")
    ollama_timeout_seconds: float = Field(default=30.0)
    max_input_chars: int = Field(default=6000)
    max_output_tokens: int = Field(default=900)
    temperature: float = Field(default=0.1)

    ocr_provider: str = Field(default="rapidocr")
    ocr_max_image_bytes: int = Field(default=1_500_000)
    ocr_max_width: int = Field(default=4096)
    ocr_max_height: int = Field(default=4096)
    ocr_slow_warning_millis: int = Field(default=5000)

    stt_provider: str = Field(default="placeholder")
    stt_model: str = Field(default="small")
    stt_device: str = Field(default="cpu")
    stt_compute_type: str = Field(default="int8")
    stt_language: str = Field(default="ko")
    stt_max_audio_bytes: int = Field(default=12_000_000)
    stt_initial_prompt: str = Field(default="헤이 자비스. 화면 번역 요청. 사 더하기 사. 4 더하기 4. 곱하기. 나누기. 빼기. 더하기.")


    tts_provider: str = Field(default="placeholder")
    tts_piper_executable: str = Field(default="piper")
    tts_model_path: str = Field(default="")
    tts_config_path: str = Field(default="")
    tts_melotts_device: str = Field(default="cpu")
    tts_melotts_speaker_id: str = Field(default="KR")
    tts_melotts_speed: float = Field(default=0.92)
    tts_cosyvoice_repo_path: str = Field(default="")
    tts_cosyvoice_model_dir: str = Field(default="")
    tts_cosyvoice_prompt_audio_path: str = Field(default="")
    tts_cosyvoice_prompt_text: str = Field(default="")
    tts_cosyvoice_prompt_text_path: str = Field(default="")
    tts_cosyvoice_text_frontend: bool = Field(default=True)
    tts_leading_silence_millis: int = Field(default=260)
    tts_max_chars: int = Field(default=320)
    tts_timeout_seconds: float = Field(default=30.0)

    wake_provider: str = Field(default="placeholder")
    wake_phrase_hint: str = Field(default="헤이 자비스")
    wake_paused: bool = Field(default=False)
    wake_max_session_millis: int = Field(default=12000)

    cors_allow_origins: list[str] = Field(
        default_factory=lambda: [
            # Tauri production/custom-protocol origins. Keep exact origins only; do not
            # use wildcard CORS for the local-only agent.
            "http://tauri.localhost",
            "https://tauri.localhost",
            "tauri://localhost",
            # Vite/Tauri dev server origins.
            "http://localhost:1420",
            "http://127.0.0.1:1420",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    @field_validator("host")
    @classmethod
    def validate_host(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("host must not be empty")
        return normalized

    @field_validator("stt_provider")
    @classmethod
    def validate_stt_provider(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"placeholder", "faster_whisper"}:
            raise ValueError("stt_provider must be placeholder or faster_whisper")
        return normalized


    @field_validator("tts_provider")
    @classmethod
    def validate_tts_provider(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"placeholder", "piper_cli", "melotts_kr", "cosyvoice2_local"}:
            raise ValueError("tts_provider must be placeholder, piper_cli, melotts_kr, or cosyvoice2_local")
        return normalized

    @field_validator("wake_provider")
    @classmethod
    def validate_wake_provider(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"placeholder", "local_stt"}:
            raise ValueError("wake_provider must be placeholder or local_stt")
        return normalized

    @field_validator("ocr_provider")
    @classmethod
    def validate_ocr_provider(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"placeholder", "rapidocr"}:
            raise ValueError("ocr_provider must be placeholder or rapidocr")
        return normalized

    def is_loopback_host(self) -> bool:
        if self.host in {"localhost"}:
            return True
        try:
            return ip_address(self.host).is_loopback
        except ValueError:
            return False


@lru_cache
def get_settings() -> Settings:
    return Settings()
