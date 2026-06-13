from typing import Literal

from pydantic import BaseModel, Field


class LocalSttHealthResponse(BaseModel):
    available: bool
    warning: str | None = None
    maxAudioBytes: int
    maxDurationMillis: int
    acceptedMimeTypes: list[str] = Field(default_factory=list)


class LocalSttTranscribeResponse(BaseModel):
    status: Literal["completed", "failed", "unavailable"]
    text: str = ""
    textReady: bool = False
    durationMillis: int | None = None
    warnings: list[str] = Field(default_factory=list)
