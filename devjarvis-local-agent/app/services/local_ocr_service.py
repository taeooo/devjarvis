from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import Any
from uuid import uuid4

from app.core.config import Settings, get_settings
from app.schemas.local_ocr import (
    LocalOcrExtractRequest,
    LocalOcrExtractResponse,
    LocalOcrHealthResponse,
    LocalOcrTextBlock,
)
from app.services.image_validator import validate_local_ocr_image


class LocalOcrService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def health(self) -> LocalOcrHealthResponse:
        provider = self.settings.ocr_provider
        warning = None

        if provider == "rapidocr" and not _is_rapidocr_importable():
            warning = "RapidOCR dependency is not available."

        return LocalOcrHealthResponse(
            available=warning is None,
            provider=provider,
            maxImageBytes=self.settings.ocr_max_image_bytes,
            maxWidth=self.settings.ocr_max_width,
            maxHeight=self.settings.ocr_max_height,
            warning=warning,
        )

    async def extract(self, request: LocalOcrExtractRequest) -> LocalOcrExtractResponse:
        validated = validate_local_ocr_image(request.image, self.settings)
        provider = self.settings.ocr_provider
        warnings: list[str] = []

        if provider == "rapidocr":
            try:
                text, blocks, provider_warnings = _extract_with_rapidocr(validated.data)
                warnings.extend(provider_warnings)
                return _build_response(
                    request=request,
                    provider=provider,
                    status="completed",
                    text=text,
                    blocks=blocks,
                    warnings=warnings,
                )
            except Exception as exc:  # noqa: BLE001
                return _build_response(
                    request=request,
                    provider=provider,
                    status="failed",
                    text="",
                    blocks=[],
                    warnings=[f"rapidocr_failed:{type(exc).__name__}"],
                )

        return _build_response(
            request=request,
            provider="placeholder",
            status="completed",
            text="",
            blocks=[],
            warnings=["local_ocr_placeholder_provider"],
        )


def get_local_ocr_service() -> LocalOcrService:
    return LocalOcrService()


def _build_response(
    *,
    request: LocalOcrExtractRequest,
    provider: str,
    status: str,
    text: str,
    blocks: list[LocalOcrTextBlock],
    warnings: list[str],
) -> LocalOcrExtractResponse:
    normalized_text = _normalize_text(text)
    return LocalOcrExtractResponse(
        requestId=request.commandId or str(uuid4()),
        provider=provider,  # type: ignore[arg-type]
        status=status,  # type: ignore[arg-type]
        text=normalized_text,
        textFound=bool(normalized_text),
        textLength=len(normalized_text),
        preview=_preview(normalized_text),
        width=request.image.width,
        height=request.image.height,
        mimeType=request.image.mimeType,
        byteSize=request.image.byteSize,
        warnings=warnings,
        extractedAt=datetime.now(timezone.utc).isoformat(),
        blocks=blocks,
    )


def _extract_with_rapidocr(image_bytes: bytes) -> tuple[str, list[LocalOcrTextBlock], list[str]]:
    from PIL import Image  # type: ignore[import-not-found]
    import numpy as np  # type: ignore[import-not-found]
    from rapidocr_onnxruntime import RapidOCR  # type: ignore[import-not-found]

    image = Image.open(BytesIO(image_bytes)).convert("RGB")
    array = np.array(image)
    engine = RapidOCR()
    result, _ = engine(array)

    if not result:
        return "", [], []

    texts: list[str] = []
    blocks: list[LocalOcrTextBlock] = []
    for item in result:
        text, confidence = _parse_rapidocr_item(item)
        if not text:
            continue
        texts.append(text)
        blocks.append(LocalOcrTextBlock(text=text, confidence=confidence))

    return "\n".join(texts), blocks, []


def _parse_rapidocr_item(item: Any) -> tuple[str, float | None]:
    if not isinstance(item, (list, tuple)) or len(item) < 2:
        return "", None

    text = str(item[1]).strip()
    confidence: float | None = None
    if len(item) >= 3:
        try:
            confidence = float(item[2])
        except (TypeError, ValueError):
            confidence = None
    return text, confidence


def _is_rapidocr_importable() -> bool:
    try:
        import rapidocr_onnxruntime  # noqa: F401
        import PIL  # noqa: F401
        import numpy  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


def _normalize_text(value: str) -> str:
    lines = [line.strip() for line in value.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return "\n".join(line for line in lines if line)


def _preview(value: str) -> str:
    text = value.strip()
    if len(text) <= 240:
        return text
    return f"{text[:237]}..."
