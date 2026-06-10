from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="DEVJARVIS_AI_",
        extra="ignore",
    )

    env: str = Field(default="local")
    app_name: str = Field(default="devjarvis-ai-server")
    app_version: str = Field(default="0.1.0")
    host: str = Field(default="127.0.0.1")
    port: int = Field(default=8000)
    log_level: str = Field(default="INFO")
    enable_docs: bool = Field(default=True)

    backend_base_url: str = Field(default="http://localhost:8080")
    ollama_base_url: str = Field(default="http://localhost:11434")

    ocr_provider: str = Field(default="placeholder")
    ocr_max_image_bytes: int = Field(default=1_500_000)
    ocr_max_width: int = Field(default=4096)
    ocr_max_height: int = Field(default=4096)

    cors_allow_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:1420",
            "http://127.0.0.1:1420",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
