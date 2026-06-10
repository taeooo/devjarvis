from base64 import b64encode

import pytest

from app.core.config import Settings
from app.schemas.local_ocr import LocalOcrImagePayload
from app.services.image_validator import validate_local_ocr_image

_JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"0" * 16


def _settings() -> Settings:
    return Settings(ocr_max_image_bytes=64, ocr_max_width=1600, ocr_max_height=1200)


def test_validate_local_ocr_image_accepts_jpeg() -> None:
    data_url = "data:image/jpeg;base64," + b64encode(_JPEG_BYTES).decode("ascii")
    image = LocalOcrImagePayload(
        dataUrl=data_url,
        mimeType="image/jpeg",
        width=10,
        height=10,
        byteSize=len(_JPEG_BYTES),
    )

    validated = validate_local_ocr_image(image, _settings())

    assert validated.byte_size == len(_JPEG_BYTES)


def test_validate_local_ocr_image_rejects_mime_mismatch() -> None:
    data_url = "data:image/png;base64," + b64encode(_JPEG_BYTES).decode("ascii")
    image = LocalOcrImagePayload(
        dataUrl=data_url,
        mimeType="image/jpeg",
        width=10,
        height=10,
        byteSize=len(_JPEG_BYTES),
    )

    with pytest.raises(ValueError, match="MIME"):
        validate_local_ocr_image(image, _settings())


def test_validate_local_ocr_image_rejects_size_mismatch() -> None:
    data_url = "data:image/jpeg;base64," + b64encode(_JPEG_BYTES).decode("ascii")
    image = LocalOcrImagePayload(
        dataUrl=data_url,
        mimeType="image/jpeg",
        width=10,
        height=10,
        byteSize=len(_JPEG_BYTES) + 1,
    )

    with pytest.raises(ValueError, match="byteSize"):
        validate_local_ocr_image(image, _settings())
