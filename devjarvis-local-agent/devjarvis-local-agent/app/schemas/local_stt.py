from typing import Literal

from pydantic import BaseModel, Field


class LocalSttHealthResponse(BaseModel):
    available: bool
    warning: str | None = None


class LocalSttTranscribeResponse(BaseModel):
    status: Literal["completed", "failed", "unavailable"]
    text: str = ""
    textReady: bool = False
    warnings: list[str] = Field(default_factory=list)
