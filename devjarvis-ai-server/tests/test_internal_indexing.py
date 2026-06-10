from fastapi.testclient import TestClient

from app.main import app


def test_validate_manifest_summarizes_requested_excluded_and_target_counts() -> None:
    client = TestClient(app)

    response = client.post(
        "/internal/indexing/validate-manifest",
        json={
            "files": [
                {
                    "relativePath": "src/main/java/com/example/App.java",
                    "fileName": "App.java",
                    "extension": "java",
                    "language": "java",
                    "sizeBytes": 1200,
                    "sha256": "sample-hash",
                    "excluded": False,
                    "excludedReason": None,
                },
                {
                    "relativePath": ".env",
                    "fileName": ".env",
                    "extension": "",
                    "language": "unknown",
                    "sizeBytes": 100,
                    "sha256": "sample-hash-2",
                    "excluded": False,
                    "excludedReason": None,
                },
            ]
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["requestedFileCount"] == 2
    assert body["data"]["excludedFileCount"] == 1
    assert body["data"]["sensitiveFileCount"] == 1
    assert body["data"]["targetFileCount"] == 1


def test_validate_manifest_rejects_path_traversal() -> None:
    client = TestClient(app)

    response = client.post(
        "/internal/indexing/validate-manifest",
        json={
            "files": [
                {
                    "relativePath": "../.env",
                    "fileName": ".env",
                    "sizeBytes": 100,
                }
            ]
        },
    )

    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"
