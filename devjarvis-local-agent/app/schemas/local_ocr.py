from typing import Literal

from pydantic import BaseModel, Field, field_validator

LocalOcrProvider = Literal["placeholder", "rapidocr"]
LocalOcrStatus = Literal["completed", "failed"]
LocalOcrMimeType = Literal["image/jpeg", "image/png", "image/webp"]


class LocalOcrHealthResponse(BaseModel):
    available: bool
    provider: LocalOcrProvider
    maxImageBytes: int
    maxWidth: int
    maxHeight: int
    warning: str | None = None


class LocalOcrImagePayload(BaseModel):
    dataUrl: str = Field(min_length=32, max_length=3_000_000)
    mimeType: LocalOcrMimeType
    width: int = Field(gt=0, le=10_000)
    height: int = Field(gt=0, le=10_000)
    byteSize: int = Field(gt=0, le=5_000_000)
    capturedAt: str | None = Field(default=None, max_length=80)

    @field_validator("dataUrl")
    @classmethod
    def validate_data_url(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized.startswith("data:image/"):
            raise ValueError("image dataUrl must be a data:image URL")
        if ";base64," not in normalized:
            raise ValueError("image dataUrl must be base64 encoded")
        return normalized


class LocalOcrExtractRequest(BaseModel):
    commandId: str | None = Field(default=None, max_length=80)
    intent: str | None = Field(default=None, max_length=80)
    image: LocalOcrImagePayload


class LocalOcrTextBlock(BaseModel):
    text: str
    confidence: float | None = None


class LocalOcrExtractResponse(BaseModel):
    requestId: str
    provider: LocalOcrProvider
    status: LocalOcrStatus
    text: str
    textFound: bool
    textLength: int
    preview: str
    width: int
    height: int
    mimeType: str
    byteSize: int
    warnings: list[str] = Field(default_factory=list)
    extractedAt: str
    blocks: list[LocalOcrTextBlock] = Field(default_factory=list)
