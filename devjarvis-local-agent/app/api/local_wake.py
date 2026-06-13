from fastapi import APIRouter, Depends

from app.core.responses import ApiResponse
from app.schemas.local_wake import LocalWakeHealthResponse, LocalWakeSessionResponse
from app.services.local_wake_service import LocalWakeService, get_local_wake_service

router = APIRouter(prefix="/internal/local-wake", tags=["local-wake"])


@router.get("/health", response_model=ApiResponse[LocalWakeHealthResponse])
async def local_wake_health(
    service: LocalWakeService = Depends(get_local_wake_service),
) -> ApiResponse[LocalWakeHealthResponse]:
    return ApiResponse.ok(await service.health())


@router.post("/session/start", response_model=ApiResponse[LocalWakeSessionResponse])
async def start_local_wake_session(
    service: LocalWakeService = Depends(get_local_wake_service),
) -> ApiResponse[LocalWakeSessionResponse]:
    return ApiResponse.ok(await service.start_session())


@router.post("/session/stop", response_model=ApiResponse[LocalWakeSessionResponse])
async def stop_local_wake_session(
    service: LocalWakeService = Depends(get_local_wake_service),
) -> ApiResponse[LocalWakeSessionResponse]:
    return ApiResponse.ok(await service.stop_session())
