from typing import Literal

from pydantic import BaseModel, Field, field_validator

LocalOcrIntent = Literal[
    "screen_translate",
    "screen_summary",
    "screen_error_analysis",
    "project_diagnosis",
    "log_analysis",
    "general_chat",
]


class LocalOcrHealthResponse(BaseModel):
    available: bool
    provider: str
    maxImageBytes: int
    maxWidth: int
    maxHeight: int
    warning: str | None = None


class LocalOcrImageRequest(BaseModel):
    dataUrl: str = Field(min_length=32, max_length=2_500_000)
    mimeType: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    byteSize: int = Field(gt=0)
    capturedAt: str

    @field_validator("mimeType")
    @classmethod
    def validate_mime_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"image/jpeg", "image/png", "image/webp"}:
            raise ValueError("unsupported image type")
        return normalized


class LocalOcrExtractRequest(BaseModel):
    commandId: str
    intent: LocalOcrIntent = "general_chat"
    contextMode: str = "screen"
    image: LocalOcrImageRequest


class LocalOcrTextBlock(BaseModel):
    text: str
    confidence: float
    x: int
    y: int
    width: int
    height: int


class LocalOcrExtractResponse(BaseModel):
    requestId: str
    provider: str
    status: Literal["completed", "failed"]
    text: str
    textFound: bool
    textLength: int
    preview: str
    width: int
    height: int
    mimeType: str
    byteSize: int
    blocks: list[LocalOcrTextBlock] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    extractedAt: str
