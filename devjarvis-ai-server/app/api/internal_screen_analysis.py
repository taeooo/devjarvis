from fastapi import APIRouter, HTTPException

from app.core.responses import ApiResponse
from app.schemas.screen_analysis import ScreenAnalysisRequest, ScreenAnalysisResponse
from app.services.screen_analysis_service import ScreenAnalysisValidationError, analyze_screen

router = APIRouter(prefix="/internal/screen", tags=["internal-screen"])


@router.post("/analyze", response_model=ApiResponse[ScreenAnalysisResponse])
def analyze_screen_context(request: ScreenAnalysisRequest) -> ApiResponse[ScreenAnalysisResponse]:
    try:
        return ApiResponse.ok(analyze_screen(request))
    except ScreenAnalysisValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
