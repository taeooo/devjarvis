from fastapi import APIRouter, HTTPException

from app.core.responses import ApiResponse
from app.schemas.ocr import OcrExtractRequest, OcrExtractResponse
from app.services.ocr_service import OcrValidationError, extract_ocr

router = APIRouter(prefix="/internal/ocr", tags=["internal-ocr"])


@router.post("/extract", response_model=ApiResponse[OcrExtractResponse])
def extract_screen_ocr(request: OcrExtractRequest) -> ApiResponse[OcrExtractResponse]:
    try:
        return ApiResponse.ok(extract_ocr(request))
    except OcrValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
