from typing import Literal

from pydantic import BaseModel, Field, field_validator

LocalSttMimeType = Literal["audio/wav", "audio/webm", "audio/ogg", "audio/mpeg"]


class LocalSttHealthResponse(BaseModel):
    available: bool
    warning: str | None = None


class LocalSttAudioPayload(BaseModel):
    dataUrl: str = Field(min_length=1, max_length=12_000_000)
    mimeType: LocalSttMimeType
    byteSize: int = Field(ge=1)
    durationMillis: int | None = Field(default=None, ge=0)
    recordedAt: str | None = None

    @field_validator("dataUrl")
    @classmethod
    def validate_data_url(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized.startswith("data:audio/"):
            raise ValueError("audio dataUrl must be an audio data URL")
        return normalized


class LocalSttTranscribeRequest(BaseModel):
    commandId: str | None = None
    audio: LocalSttAudioPayload | None = None


class LocalSttTranscribeResponse(BaseModel):
    status: Literal["completed", "failed", "unavailable"]
    text: str = ""
    textReady: bool = False
    warnings: list[str] = Field(default_factory=list)
