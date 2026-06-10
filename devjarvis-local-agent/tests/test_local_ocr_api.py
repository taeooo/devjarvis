from fastapi.testclient import TestClient

from app.api.local_ocr import get_local_ocr_service
from app.main import app
from app.schemas.local_ocr import LocalOcrExtractRequest, LocalOcrExtractResponse, LocalOcrHealthResponse

PNG_1X1_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
PNG_1X1_BYTE_SIZE = 68


class StubLocalOcrService:
    async def health(self) -> LocalOcrHealthResponse:
        return LocalOcrHealthResponse(
            available=True,
            provider="stub",
            maxImageBytes=1_500_000,
            maxWidth=4096,
            maxHeight=4096,
        )

    async def extract(self, request: LocalOcrExtractRequest) -> LocalOcrExtractResponse:
        return LocalOcrExtractResponse(
            requestId=request.commandId,
            provider="stub",
            status="completed",
            text="hello screen",
            textFound=True,
            textLength=12,
            preview="hello screen",
            width=request.image.width,
            height=request.image.height,
            mimeType=request.image.mimeType,
            byteSize=request.image.byteSize,
            warnings=[],
            extractedAt="2026-06-11T00:00:00+00:00",
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
            "contextMode": "screen",
            "image": {
                "dataUrl": PNG_1X1_DATA_URL,
                "mimeType": "image/png",
                "width": 1,
                "height": 1,
                "byteSize": PNG_1X1_BYTE_SIZE,
                "capturedAt": "2026-06-11T00:00:00+09:00",
            },
        },
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["data"]["textFound"] is True
