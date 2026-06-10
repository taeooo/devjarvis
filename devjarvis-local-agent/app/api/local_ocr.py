from fastapi import APIRouter, Depends, HTTPException

from app.core.responses import ApiResponse
from app.schemas.local_ocr import LocalOcrExtractRequest, LocalOcrExtractResponse, LocalOcrHealthResponse
from app.services.local_ocr_service import LocalOcrService, get_local_ocr_service

router = APIRouter(prefix="/internal/local-ocr", tags=["local-ocr"])


@router.get("/health", response_model=ApiResponse[LocalOcrHealthResponse])
async def local_ocr_health(
    service: LocalOcrService = Depends(get_local_ocr_service),
) -> ApiResponse[LocalOcrHealthResponse]:
    return ApiResponse.ok(await service.health())


@router.post("/extract", response_model=ApiResponse[LocalOcrExtractResponse])
async def extract(
    request: LocalOcrExtractRequest,
    service: LocalOcrService = Depends(get_local_ocr_service),
) -> ApiResponse[LocalOcrExtractResponse]:
    try:
        return ApiResponse.ok(await service.extract(request))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid screen image payload.") from exc
