from app.schemas.indexing import ValidateManifestRequest, ValidateManifestResponse


def validate_manifest(request: ValidateManifestRequest) -> ValidateManifestResponse:
    requested_file_count = len(request.files)
    sensitive_file_count = sum(1 for file in request.files if file.is_sensitive_file())
    excluded_file_count = sum(1 for file in request.files if file.excluded or file.is_sensitive_file())
    target_file_count = requested_file_count - excluded_file_count

    return ValidateManifestResponse(
        requested_file_count=requested_file_count,
        excluded_file_count=excluded_file_count,
        sensitive_file_count=sensitive_file_count,
        target_file_count=target_file_count,
    )
