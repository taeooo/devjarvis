from abc import ABC, abstractmethod

from app.schemas.ocr import OcrExtractRequest, OcrExtractResponse


class OcrProvider(ABC):
    @abstractmethod
    def extract(self, request: OcrExtractRequest) -> OcrExtractResponse:
        raise NotImplementedError
