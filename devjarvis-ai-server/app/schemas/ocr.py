from pydantic import BaseModel, Field


class OcrExtractImage(BaseModel):
    mime_type: str = Field(alias="mimeType")
    image_base64: str = Field(alias="imageBase64")
    width: int
    height: int
    byte_size: int = Field(alias="byteSize")
    captured_at: str = Field(alias="capturedAt")


class OcrExtractRequest(BaseModel):
    request_id: str = Field(alias="requestId")
    command_id: str = Field(alias="commandId")
    intent: str
    context_mode: str = Field(alias="contextMode")
    mime_type: str = Field(alias="mimeType")
    image_base64: str = Field(alias="imageBase64")
    width: int
    height: int
    byte_size: int = Field(alias="byteSize")
    captured_at: str = Field(alias="capturedAt")


class OcrTextBlock(BaseModel):
    text: str
    confidence: float
    x: int
    y: int
    width: int
    height: int


class OcrImageSummary(BaseModel):
    width: int
    height: int
    mime_type: str = Field(alias="mimeType")
    byte_size: int = Field(alias="byteSize")


class OcrExtractResponse(BaseModel):
    request_id: str = Field(alias="requestId")
    provider: str
    status: str
    text: str
    text_found: bool = Field(alias="textFound")
    language: str | None = None
    confidence: float | None = None
    blocks: list[OcrTextBlock] = Field(default_factory=list)
    image: OcrImageSummary
    warnings: list[str] = Field(default_factory=list)
    elapsed_millis: int = Field(alias="elapsedMillis")
