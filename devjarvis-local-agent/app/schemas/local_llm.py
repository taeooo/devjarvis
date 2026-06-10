from typing import Literal

from pydantic import BaseModel, Field, field_validator

LocalLlmIntent = Literal[
    "screen_translate",
    "screen_summary",
    "screen_error_analysis",
    "project_diagnosis",
    "log_analysis",
    "general_chat",
]


class LocalLlmHealthResponse(BaseModel):
    available: bool
    provider: str = "ollama"
    model: str | None = None
    baseUrl: str
    warning: str | None = None


class LocalLlmAnalyzeRequest(BaseModel):
    commandId: str | None = None
    intent: LocalLlmIntent = "general_chat"
    text: str = Field(min_length=1, max_length=12000)
    context: str | None = Field(default=None, max_length=4000)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("text must not be blank")
        return normalized


class LocalLlmAnalyzeResponse(BaseModel):
    status: Literal["completed", "failed"]
    provider: str = "ollama"
    model: str | None = None
    intent: LocalLlmIntent
    summary: str
    detail: str | None = None
    actionItems: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
