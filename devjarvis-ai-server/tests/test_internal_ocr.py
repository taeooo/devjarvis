import base64

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_internal_ocr_extract_placeholder() -> None:
    image_bytes = b"\xff\xd8\xff" + (b"0" * 32)
    response = client.post(
        "/internal/ocr/extract",
        json={
            "requestId": "req-12345678",
            "commandId": "cmd-12345678",
            "intent": "screen_translate",
            "contextMode": "screen",
            "mimeType": "image/jpeg",
            "imageBase64": base64.b64encode(image_bytes).decode("ascii"),
            "width": 100,
            "height": 100,
            "byteSize": len(image_bytes),
            "capturedAt": "2026-06-10T00:00:00Z",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["provider"] == "placeholder"
    assert payload["data"]["image"]["byteSize"] == len(image_bytes)


def test_internal_ocr_rejects_invalid_mime_type() -> None:
    image_bytes = b"<svg></svg>"
    response = client.post(
        "/internal/ocr/extract",
        json={
            "requestId": "req-12345678",
            "commandId": "cmd-12345678",
            "intent": "screen_translate",
            "contextMode": "screen",
            "mimeType": "image/svg+xml",
            "imageBase64": base64.b64encode(image_bytes).decode("ascii"),
            "width": 100,
            "height": 100,
            "byteSize": len(image_bytes),
            "capturedAt": "2026-06-10T00:00:00Z",
        },
    )

    assert response.status_code == 400
