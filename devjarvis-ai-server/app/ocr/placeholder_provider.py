from time import perf_counter

from app.schemas.ocr import OcrExtractRequest, OcrExtractResponse, OcrImageSummary
from app.ocr.provider import OcrProvider


class PlaceholderOcrProvider(OcrProvider):
    def extract(self, request: OcrExtractRequest) -> OcrExtractResponse:
        started_at = perf_counter()
        elapsed_millis = int((perf_counter() - started_at) * 1000)
        return OcrExtractResponse(
            requestId=request.request_id,
            provider="placeholder",
            status="completed",
            text="",
            textFound=False,
            language=None,
            confidence=None,
            blocks=[],
            image=OcrImageSummary(
                width=request.width,
                height=request.height,
                mimeType=request.mime_type,
                byteSize=request.byte_size,
            ),
            warnings=[
                "OCR provider is configured as placeholder. Replace DEVJARVIS_AI_OCR_PROVIDER with rapidocr, paddleocr, or easyocr later.",
            ],
            elapsedMillis=elapsed_millis,
        )
