from fastapi.testclient import TestClient

from app.main import app


def test_internal_screen_analysis_returns_placeholder_result():
    client = TestClient(app)
    response = client.post(
        "/internal/screen/analyze",
        json={
            "requestId": "screen-analysis-test-1",
            "commandId": "command-analysis-test-1",
            "intent": "screen_summary",
            "contextMode": "screen",
            "ocrProvider": "rapidocr",
            "ocrText": "Traceback: ModuleNotFoundError: No module named fastapi",
            "ocrTextFound": True,
            "width": 1280,
            "height": 720,
            "capturedAt": "2026-06-10T00:00:00Z",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["provider"] == "screen-analysis-placeholder"
    assert payload["data"]["status"] == "analysis_ready"
    assert payload["data"]["textUsedLength"] > 0


def test_internal_screen_analysis_rejects_unsupported_intent():
    client = TestClient(app)
    response = client.post(
        "/internal/screen/analyze",
        json={
            "requestId": "screen-analysis-test-2",
            "commandId": "command-analysis-test-2",
            "intent": "unsafe_intent",
            "contextMode": "screen",
            "ocrProvider": "rapidocr",
            "ocrText": "hello",
            "ocrTextFound": True,
            "width": 1280,
            "height": 720,
            "capturedAt": "2026-06-10T00:00:00Z",
        },
    )

    assert response.status_code == 422
