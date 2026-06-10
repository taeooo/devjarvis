import asyncio

import pytest

from app.core.config import Settings
from app.schemas.local_ocr import LocalOcrExtractRequest, LocalOcrExtractResponse
from app.services.local_ocr_service import LocalOcrProvider, LocalOcrService, LocalOcrValidationError

PNG_1X1_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
PNG_1X1_BYTE_SIZE = 68


class EchoProvider:
    name = "echo"

    def check_available(self) -> str | None:
        return None

    def extract(self, request: LocalOcrExtractRequest, image_base64: str, settings: Settings) -> LocalOcrExtractResponse:  # noqa: ARG002
        return LocalOcrExtractResponse(
            requestId=request.commandId,
            provider=self.name,
            status="completed",
            text="token=abc@example.com",
            textFound=True,
            textLength=21,
            preview="token=<redacted>",
            width=request.image.width,
            height=request.image.height,
            mimeType=request.image.mimeType,
            byteSize=request.image.byteSize,
            warnings=[],
            extractedAt="2026-06-11T00:00:00+00:00",
        )


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


def test_local_ocr_service_validates_and_extracts() -> None:
    service = LocalOcrService(settings=Settings(local_ocr_provider="placeholder"), provider=EchoProvider())

    response = asyncio.run(service.extract(_request()))

    assert response.textFound is True
    assert response.width == 1


def test_local_ocr_service_rejects_mismatched_size() -> None:
    service = LocalOcrService(settings=Settings(local_ocr_provider="placeholder"), provider=EchoProvider())

    with pytest.raises(LocalOcrValidationError):
        asyncio.run(service.extract(_request(byte_size=1)))
