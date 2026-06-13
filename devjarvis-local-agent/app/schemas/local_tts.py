from pydantic import BaseModel, Field


class LocalTtsHealthResponse(BaseModel):
    available: bool
    warning: str | None = None


class LocalTtsSynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=400)
