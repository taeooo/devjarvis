from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.responses import ApiResponse
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


def _build_health_response() -> ApiResponse[HealthResponse]:
    settings = get_settings()
    return ApiResponse.ok(
        HealthResponse(
            status="UP",
            service=settings.app_name,
            version=settings.app_version,
            environment=settings.env,
            checked_at=datetime.now(timezone.utc),
        )
    )


@router.get("/health", response_model=ApiResponse[HealthResponse])
def health() -> ApiResponse[HealthResponse]:
    return _build_health_response()


@router.get("/internal/health", response_model=ApiResponse[HealthResponse])
def internal_health() -> ApiResponse[HealthResponse]:
    return _build_health_response()
