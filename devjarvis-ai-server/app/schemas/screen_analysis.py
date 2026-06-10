from pydantic import BaseModel, Field, field_validator


class ScreenAnalysisRequest(BaseModel):
    request_id: str = Field(alias="requestId", min_length=8, max_length=128)
    command_id: str = Field(alias="commandId", min_length=8, max_length=128)
    intent: str = Field(min_length=1, max_length=64)
    context_mode: str = Field(alias="contextMode", min_length=1, max_length=32)
    ocr_provider: str = Field(alias="ocrProvider", min_length=1, max_length=64)
    ocr_text: str = Field(alias="ocrText", max_length=12000)
    ocr_text_found: bool = Field(alias="ocrTextFound")
    width: int = Field(ge=1, le=4096)
    height: int = Field(ge=1, le=4096)
    captured_at: str = Field(alias="capturedAt", min_length=1, max_length=128)

    @field_validator("intent")
    @classmethod
    def validate_intent(cls, value: str) -> str:
        allowed = {
            "screen_translate",
            "screen_summary",
            "screen_error_analysis",
            "project_diagnosis",
            "log_analysis",
            "general_chat",
        }
        normalized = value.strip()
        if normalized not in allowed:
            raise ValueError("Unsupported screen analysis intent.")
        return normalized

    @field_validator("context_mode")
    @classmethod
    def validate_context_mode(cls, value: str) -> str:
        allowed = {"screen", "project", "general", "auto"}
        normalized = value.strip()
        if normalized not in allowed:
            raise ValueError("Unsupported screen analysis context mode.")
        return normalized

    @field_validator("ocr_text")
    @classmethod
    def sanitize_text(cls, value: str) -> str:
        return " ".join(value.replace("\u0000", " ").split())


class ScreenAnalysisResponse(BaseModel):
    request_id: str = Field(alias="requestId")
    provider: str
    status: str
    intent: str
    title: str
    summary: str
    detail: str
    action_items: list[str] = Field(alias="actionItems", default_factory=list)
    text_used_length: int = Field(alias="textUsedLength")
    warnings: list[str] = Field(default_factory=list)
    elapsed_millis: int = Field(alias="elapsedMillis")
