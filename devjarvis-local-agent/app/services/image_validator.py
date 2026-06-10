from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass

from app.core.config import Settings
from app.schemas.local_ocr import LocalOcrImagePayload


@dataclass(frozen=True)
class ValidatedImage:
    data: bytes
    mime_type: str
    width: int
    height: int
    byte_size: int


_ALLOWED_MAGIC_BYTES: dict[str, tuple[bytes, ...]] = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),
}


def validate_local_ocr_image(image: LocalOcrImagePayload, settings: Settings) -> ValidatedImage:
    if image.byteSize > settings.ocr_max_image_bytes:
        raise ValueError("image byte size exceeds local OCR limit")
    if image.width > settings.ocr_max_width or image.height > settings.ocr_max_height:
        raise ValueError("image dimensions exceed local OCR limit")

    prefix = f"data:{image.mimeType};base64,"
    if not image.dataUrl.startswith(prefix):
        raise ValueError("image dataUrl MIME does not match request MIME")

    encoded = image.dataUrl[len(prefix):]
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("image dataUrl contains invalid base64") from exc

    if not decoded:
        raise ValueError("image payload is empty")
    if len(decoded) > settings.ocr_max_image_bytes:
        raise ValueError("decoded image exceeds local OCR limit")
    if len(decoded) != image.byteSize:
        raise ValueError("image byteSize does not match decoded payload")
    if not _has_valid_magic_bytes(image.mimeType, decoded):
        raise ValueError("image binary signature does not match MIME type")

    return ValidatedImage(
        data=decoded,
        mime_type=image.mimeType,
        width=image.width,
        height=image.height,
        byte_size=len(decoded),
    )


def _has_valid_magic_bytes(mime_type: str, data: bytes) -> bool:
    signatures = _ALLOWED_MAGIC_BYTES.get(mime_type)
    if not signatures:
        return False

    if mime_type == "image/webp":
        return len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP"

    return any(data.startswith(signature) for signature in signatures)
