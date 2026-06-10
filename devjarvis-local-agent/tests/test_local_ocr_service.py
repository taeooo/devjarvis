import asyncio

import pytest

from app.core.config import Settings
from app.schemas.local_ocr import LocalOcrExtractRequest
from app.services.local_ocr_service import LocalOcrService

PNG_1X1_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
PNG_1X1_BYTE_SIZE = 68


def _request(data_url: str = PNG_1X1_DATA_URL, byte_size: int = PNG_1X1_BYTE_SIZE) -> LocalOcrExtractRequest:
    return LocalOcrExtractRequest(
        commandId="cmd-1",
        intent="screen_summary",
        contextMode="screen",
        image={
            "dataUrl": data_url,
            "mimeType": "image/png",
            "width": 1,
            "height": 1,
            "byteSize": byte_size,
            "capturedAt": "2026-06-11T00:00:00+09:00",
        },
    )


def test_local_ocr_service_validates_and_returns_placeholder_response() -> None:
    service = LocalOcrService(settings=Settings(ocr_provider="placeholder"))

    response = asyncio.run(service.extract(_request()))

    assert response.status == "completed"
    assert response.textFound is False
    assert response.width == 1
    assert "local_ocr_placeholder_provider" in response.warnings


def test_local_ocr_service_rejects_mismatched_size() -> None:
    service = LocalOcrService(settings=Settings(ocr_provider="placeholder"))

    with pytest.raises(ValueError):
        asyncio.run(service.extract(_request(byte_size=1)))
