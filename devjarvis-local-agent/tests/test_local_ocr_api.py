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
            maxImageBytes=1_500_000,
            maxWidth=4096,
            maxHeight=4096,
        )

    async def extract(self, request: LocalOcrExtractRequest) -> LocalOcrExtractResponse:
        return LocalOcrExtractResponse(
            requestId=request.commandId or "stub",
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


def test_local_ocr_health_returns_minimal_readiness() -> None:
    app.dependency_overrides[get_local_ocr_service] = lambda: StubLocalOcrService()
    client = TestClient(app)

    response = client.get("/internal/local-ocr/health", headers={"host": "127.0.0.1:17997"})

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["available"] is True
    assert "provider" not in data


def test_local_ocr_extract_returns_no_provider_details() -> None:
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
                "dataUrl": _JPEG_DATA_URL,
                "mimeType": "image/jpeg",
                "width": 10,
                "height": 10,
                "byteSize": len(_JPEG_BYTES),
                "capturedAt": "2026-06-11T00:00:00+09:00",
            },
        },
    )

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["textFound"] is True
    assert "provider" not in data


def test_local_ocr_extract_rejects_invalid_payload() -> None:
    client = TestClient(app)

    response = client.post(
        "/internal/local-ocr/extract",
        headers={"host": "127.0.0.1:17997"},
        json={
            "commandId": "cmd-1",
            "intent": "screen_summary",
            "image": {
                "dataUrl": "data:image/jpeg;base64,not-base64",
                "mimeType": "image/jpeg",
                "width": 10,
                "height": 10,
                "byteSize": 10,
            },
        },
    )

    assert response.status_code in {400, 422}
