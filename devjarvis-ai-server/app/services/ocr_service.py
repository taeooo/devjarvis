import base64
from time import perf_counter

from app.core.config import get_settings
from app.ocr.placeholder_provider import PlaceholderOcrProvider
from app.ocr.provider import OcrProvider
from app.ocr.rapidocr_provider import RapidOcrProvider
from app.schemas.ocr import OcrExtractRequest, OcrExtractResponse

_SAFE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


class OcrValidationError(ValueError):
    pass


def extract_ocr(request: OcrExtractRequest) -> OcrExtractResponse:
    started_at = perf_counter()
    settings = get_settings()
    _validate_request(request, settings.ocr_max_image_bytes, settings.ocr_max_width, settings.ocr_max_height)
    provider = _create_provider(settings.ocr_provider)
    response = provider.extract(request)
    elapsed_millis = int((perf_counter() - started_at) * 1000)
    response.elapsed_millis = elapsed_millis
    return response


def _create_provider(provider_name: str) -> OcrProvider:
    normalized = provider_name.strip().lower()
    if normalized == "placeholder":
        return PlaceholderOcrProvider()

    if normalized == "rapidocr":
        return RapidOcrProvider()

    # Keep future provider names reserved so configuration can be introduced safely.
    if normalized in {"paddleocr", "easyocr"}:
        return PlaceholderOcrProvider()

    raise OcrValidationError("Unsupported OCR provider.")


def _validate_request(request: OcrExtractRequest, max_bytes: int, max_width: int, max_height: int) -> None:
    mime_type = request.mime_type.strip().lower()
    if mime_type not in _SAFE_MIME_TYPES:
        raise OcrValidationError("Unsupported image type.")

    if request.width <= 0 or request.width > max_width:
        raise OcrValidationError("Image width is not allowed.")
    if request.height <= 0 or request.height > max_height:
        raise OcrValidationError("Image height is not allowed.")
    if request.byte_size <= 0 or request.byte_size > max_bytes:
        raise OcrValidationError("Image payload is too large.")

    try:
        image_bytes = base64.b64decode(request.image_base64, validate=True)
    except Exception as exc:  # noqa: BLE001 - return a safe public validation message.
        raise OcrValidationError("Image base64 payload is invalid.") from exc

    if len(image_bytes) != request.byte_size:
        raise OcrValidationError("Image byte size mismatch.")
    if not _has_expected_magic_bytes(mime_type, image_bytes):
        raise OcrValidationError("Image binary signature is invalid.")


def _has_expected_magic_bytes(mime_type: str, image_bytes: bytes) -> bool:
    if mime_type == "image/jpeg":
        return len(image_bytes) >= 3 and image_bytes[:3] in {b"\xff\xd8\xff"}
    if mime_type == "image/png":
        return image_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/webp":
        return len(image_bytes) >= 12 and image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP"
    return False
