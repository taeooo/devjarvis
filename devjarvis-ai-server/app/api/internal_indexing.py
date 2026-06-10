from fastapi import APIRouter

from app.core.responses import ApiResponse
from app.schemas.indexing import ValidateManifestRequest, ValidateManifestResponse
from app.services.indexing_manifest_validator import validate_manifest

router = APIRouter(prefix="/internal/indexing", tags=["internal-indexing"])


@router.post("/validate-manifest", response_model=ApiResponse[ValidateManifestResponse])
def validate_project_file_manifest(
    request: ValidateManifestRequest,
) -> ApiResponse[ValidateManifestResponse]:
    return ApiResponse.ok(validate_manifest(request))
