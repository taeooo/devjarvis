import base64
from io import BytesIO

from PIL import Image

from app.ocr.rapidocr_provider import RapidOcrProvider
from app.schemas.ocr import OcrExtractRequest


class FakeRapidOcrEngine:
    def __call__(self, _image):
        return (
            [
                ([[10, 20], [110, 20], [110, 50], [10, 50]], "Hello", 0.91),
                ([[10, 60], [120, 60], [120, 90], [10, 90]], "World", 0.87),
            ],
            0.01,
        )


def _jpeg_request() -> OcrExtractRequest:
    image = Image.new("RGB", (160, 120), color="white")
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    image_bytes = buffer.getvalue()
    return OcrExtractRequest(
        requestId="req-rapidocr",
        commandId="cmd-rapidocr",
        intent="screen_summary",
        contextMode="screen",
        mimeType="image/jpeg",
        imageBase64=base64.b64encode(image_bytes).decode("ascii"),
        width=160,
        height=120,
        byteSize=len(image_bytes),
        capturedAt="2026-06-10T00:00:00Z",
    )


def test_rapidocr_provider_extracts_blocks_with_fake_engine() -> None:
    provider = RapidOcrProvider(engine=FakeRapidOcrEngine())

    response = provider.extract(_jpeg_request())

    assert response.provider == "rapidocr"
    assert response.status == "completed"
    assert response.text_found is True
    assert response.text == "Hello\nWorld"
    assert len(response.blocks) == 2
    assert response.confidence == 0.89
    assert response.blocks[0].x == 10
    assert response.blocks[0].y == 20
