from __future__ import annotations

import importlib
from datetime import datetime, timezone
from io import BytesIO
from time import perf_counter
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
from app.services.text_sanitizer import redact_sensitive_text


def get_local_ocr_service() -> "LocalOcrService":
    return LocalOcrService()


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
            provider=provider,  # type: ignore[arg-type]
            maxImageBytes=self.settings.ocr_max_image_bytes,
            maxWidth=self.settings.ocr_max_width,
            maxHeight=self.settings.ocr_max_height,
            warning=warning,
        )

    async def extract(self, request: LocalOcrExtractRequest) -> LocalOcrExtractResponse:
        validated = validate_local_ocr_image(request.image, self.settings)
        provider = self.settings.ocr_provider

        if provider == "rapidocr":
            started_at = perf_counter()
            try:
                text, blocks, warnings = _extract_with_rapidocr(validated.data)
            except Exception as exc:  # noqa: BLE001 - do not log or return image/OCR text.
                return _build_response(
                    request=request,
                    provider="rapidocr",
                    status="failed",
                    text="",
                    blocks=[],
                    warnings=[f"rapidocr_failed:{type(exc).__name__}"],
                )

            elapsed_ms = int((perf_counter() - started_at) * 1000)
            if elapsed_ms > self.settings.ocr_slow_warning_millis:
                warnings.append("local_ocr_slow")

            return _build_response(
                request=request,
                provider="rapidocr",
                status="completed",
                text=text,
                blocks=blocks,
                warnings=warnings,
            )

        return _build_response(
            request=request,
            provider="placeholder",
            status="completed",
            text="",
            blocks=[],
            warnings=["local_ocr_placeholder_provider"],
        )


def _extract_with_rapidocr(image_bytes: bytes) -> tuple[str, list[LocalOcrTextBlock], list[str]]:
    image_array = _decode_image_for_rapidocr(image_bytes)
    engine_class = _load_rapidocr_engine_class()
    engine = engine_class()
    raw_result = engine(image_array)
    blocks = _parse_rapidocr_blocks(raw_result)
    text = "\n".join(block.text for block in blocks if block.text).strip()
    return text, blocks, []


def _decode_image_for_rapidocr(image_bytes: bytes) -> Any:
    from PIL import Image  # type: ignore[import-not-found]
    import numpy as np  # type: ignore[import-not-found]

    Image.MAX_IMAGE_PIXELS = 20_000_000
    with BytesIO(image_bytes) as buffer:
        with Image.open(buffer) as image:
            image.load()
            return np.array(image.convert("RGB"))


def _load_rapidocr_engine_class() -> Any:
    candidates = (
        ("rapidocr_onnxruntime", "RapidOCR"),
        ("rapidocr", "RapidOCR"),
    )
    errors: list[str] = []

    for module_name, class_name in candidates:
        try:
            module = importlib.import_module(module_name)
            return getattr(module, class_name)
        except Exception as exc:  # noqa: BLE001 - try next supported RapidOCR package.
            errors.append(f"{module_name}:{type(exc).__name__}")

    raise ImportError(";".join(errors) or "rapidocr module missing")


def _is_rapidocr_importable() -> bool:
    try:
        _load_rapidocr_engine_class()
        import PIL  # noqa: F401
        import numpy  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


def _parse_rapidocr_blocks(raw_result: Any) -> list[LocalOcrTextBlock]:
    records = _extract_rapidocr_records(raw_result)
    blocks: list[LocalOcrTextBlock] = []

    for record in records:
        parsed = _parse_rapidocr_record(record)
        if parsed is not None:
            blocks.append(parsed)

    return sorted(blocks, key=lambda block: (block.y or 0, block.x or 0))


def _extract_rapidocr_records(raw_result: Any) -> list[Any]:
    if raw_result is None:
        return []

    if hasattr(raw_result, "boxes") and hasattr(raw_result, "txts"):
        boxes = list(getattr(raw_result, "boxes") or [])
        texts = list(getattr(raw_result, "txts") or [])
        scores = list(getattr(raw_result, "scores", []) or [])
        return list(zip(boxes, texts, scores))

    if isinstance(raw_result, tuple):
        if raw_result and isinstance(raw_result[0], list):
            return raw_result[0] or []
        return list(raw_result)

    if isinstance(raw_result, list):
        return raw_result

    return []


def _parse_rapidocr_record(record: Any) -> LocalOcrTextBlock | None:
    if not isinstance(record, (list, tuple)) or len(record) < 2:
        return None

    box = record[0]
    text_candidate = record[1]
    score_candidate = record[2] if len(record) > 2 else None

    if isinstance(text_candidate, (list, tuple)) and text_candidate:
        text = str(text_candidate[0]).strip()
        if len(text_candidate) > 1:
            score_candidate = text_candidate[1]
    else:
        text = str(text_candidate).strip()

    if not text:
        return None

    confidence = _parse_confidence(score_candidate)
    x, y, width, height = _box_to_bounds(box)

    return LocalOcrTextBlock(
        text=text,
        confidence=confidence,
        x=x,
        y=y,
        width=width,
        height=height,
    )


def _parse_confidence(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return None


def _box_to_bounds(box: Any) -> tuple[int, int, int, int]:
    points: list[tuple[float, float]] = []
    if isinstance(box, (list, tuple)):
        for point in box:
            if isinstance(point, (list, tuple)) and len(point) >= 2:
                points.append((float(point[0]), float(point[1])))

    if not points:
        return 0, 0, 0, 0

    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    min_x = max(0, int(min(xs)))
    min_y = max(0, int(min(ys)))
    max_x = max(min_x, int(max(xs)))
    max_y = max(min_y, int(max(ys)))
    return min_x, min_y, max_x - min_x, max_y - min_y


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
    preview, preview_warnings = redact_sensitive_text(normalized_text, max_chars=240)

    return LocalOcrExtractResponse(
        requestId=request.commandId or str(uuid4()),
        provider=provider,  # type: ignore[arg-type]
        status=status,  # type: ignore[arg-type]
        text=normalized_text,
        textFound=bool(normalized_text),
        textLength=len(normalized_text),
        preview=preview,
        width=request.image.width,
        height=request.image.height,
        mimeType=request.image.mimeType,
        byteSize=request.image.byteSize,
        warnings=[*warnings, *preview_warnings],
        extractedAt=datetime.now(timezone.utc).isoformat(),
        blocks=blocks,
    )


def _normalize_text(value: str) -> str:
    lines = [line.strip() for line in value.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return "\n".join(line for line in lines if line)
