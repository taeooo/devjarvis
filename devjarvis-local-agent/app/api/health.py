from fastapi import APIRouter

from app.core.config import get_settings
from app.core.responses import ApiResponse
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=ApiResponse[HealthResponse])
async def health() -> ApiResponse[HealthResponse]:
    settings = get_settings()
    return ApiResponse.ok(
        HealthResponse(
            status="UP",
            loopbackOnly=settings.require_loopback,
        )
    )
