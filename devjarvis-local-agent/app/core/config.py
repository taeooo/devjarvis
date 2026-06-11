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
    stt_max_audio_bytes: int = Field(default=12_000_000)

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
        if normalized != "placeholder":
            raise ValueError("stt_provider must be placeholder")
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
