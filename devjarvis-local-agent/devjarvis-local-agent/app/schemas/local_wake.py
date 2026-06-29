from typing import Literal

from pydantic import BaseModel


class LocalWakeHealthResponse(BaseModel):
    available: bool
    listening: bool = False
    paused: bool = False
    warning: str | None = None
    phraseHint: str
    maxSessionMillis: int


class LocalWakeSessionResponse(BaseModel):
    status: Literal["started", "stopped", "paused", "unavailable"]
    listening: bool = False
    paused: bool = False
    warning: str | None = None
