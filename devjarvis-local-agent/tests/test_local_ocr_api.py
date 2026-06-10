from base64 import b64encode

from fastapi.testclient import TestClient

from app.api.local_ocr import get_local_ocr_service
from app.main import app
from app.schemas.local_ocr import LocalOcrExtractRequest, LocalOcrExtractResponse, LocalOcrHealthResponse

_JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"0" * 32
_JPEG_DATA_URL = "data:image/jpeg;base64," + b64encode(_JPEG_BYTES).decode("ascii")


class StubLocalOcrService:
    async def health(self) -> LocalOcrHealthResponse:
        return LocalOcrHealthResponse(
            available=True,
            provider="placeholder",
            maxImageBytes=1_500_000,
            maxWidth=1600,
            maxHeight=1200,
        )

    async def extract(self, request: LocalOcrExtractRequest) -> LocalOcrExtractResponse:
        return LocalOcrExtractResponse(
            requestId=request.commandId or "stub",
            provider="placeholder",
            status="completed",
            text="hello",
            textFound=True,
            textLength=5,
            preview="hello",
            width=request.image.width,
            height=request.image.height,
            mimeType=request.image.mimeType,
            byteSize=request.image.byteSize,
            extractedAt="2026-01-01T00:00:00+00:00",
        )


def test_local_ocr_health() -> None:
    app.dependency_overrides[get_local_ocr_service] = lambda: StubLocalOcrService()
    client = TestClient(app)

    response = client.get("/internal/local-ocr/health", headers={"host": "127.0.0.1:17997"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["data"]["available"] is True


def test_local_ocr_extract() -> None:
    app.dependency_overrides[get_local_ocr_service] = lambda: StubLocalOcrService()
    client = TestClient(app)

    response = client.post(
        "/internal/local-ocr/extract",
        headers={"host": "127.0.0.1:17997"},
        json={
            "commandId": "cmd-1",
            "intent": "screen_summary",
            "image": {
                "dataUrl": _JPEG_DATA_URL,
                "mimeType": "image/jpeg",
                "width": 10,
                "height": 10,
                "byteSize": len(_JPEG_BYTES),
                "capturedAt": "2026-01-01T00:00:00+00:00",
            },
        },
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["data"]["text"] == "hello"
