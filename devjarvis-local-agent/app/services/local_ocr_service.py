from __future__ import annotations

import base64
import importlib
from datetime import datetime, timezone
from io import BytesIO
from time import perf_counter
from typing import Any, Protocol

from app.core.config import Settings, get_settings
from app.schemas.local_ocr import (
    LocalOcrExtractRequest,
    LocalOcrExtractResponse,
    LocalOcrHealthResponse,
    LocalOcrTextBlock,
)
from app.services.text_sanitizer import redact_sensitive_text

try:
    from PIL import Image

    Image.MAX_IMAGE_PIXELS = 20_000_000
except Exception:  # noqa: BLE001 - optional OCR dependency is reported through health/extract responses.
    Image = None  # type: ignore[assignment]

try:
    import numpy as np
except Exception:  # noqa: BLE001 - optional OCR dependency is reported through health/extract responses.
    np = None  # type: ignore[assignment]

_SAFE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


class LocalOcrValidationError(ValueError):
    pass


class LocalOcrProvider(Protocol):
    name: str

    def check_available(self) -> str | None:
        """Return a warning when the provider is not ready."""

    def extract(self, request: LocalOcrExtractRequest, image_base64: str, settings: Settings) -> LocalOcrExtractResponse:
        """Extract text from a validated image payload."""


class PlaceholderLocalOcrProvider:
    name = "placeholder"

    def check_available(self) -> str | None:
        return None

    def extract(self, request: LocalOcrExtractRequest, image_base64: str, settings: Settings) -> LocalOcrExtractResponse:  # noqa: ARG002
        return _build_response(
            request=request,
            provider=self.name,
            status="completed",
            text="",
            blocks=[],
            warnings=["local_ocr_placeholder"],
        )


class RapidOcrLocalProvider:
    name = "rapidocr"

    def __init__(self, engine: Any | None = None) -> None:
        self._engine = engine

    def check_available(self) -> str | None:
        if Image is None or np is None:
            return "RapidOCR requires Pillow and numpy. Install the local OCR requirements and restart DevJarvis Local Agent."
        try:
            self._load_engine_class()
            return None
        except Exception as exc:  # noqa: BLE001
            return f"RapidOCR is not ready: {exc.__class__.__name__}"

    def extract(self, request: LocalOcrExtractRequest, image_base64: str, settings: Settings) -> LocalOcrExtractResponse:  # noqa: ARG002
        started_at = perf_counter()
        warnings: list[str] = []

        if Image is None or np is None:
            return _build_response(
                request=request,
                provider=self.name,
                status="failed",
                text="",
                blocks=[],
                warnings=["rapidocr_dependency_missing"],
            )

        try:
            image_array = self._decode_image(image_base64)
            engine = self._engine or self._load_engine_class()()
            raw_result = engine(image_array)
            blocks = self._parse_blocks(raw_result)
        except ImportError:
            return _build_response(
                request=request,
                provider=self.name,
                status="failed",
                text="",
                blocks=[],
                warnings=["rapidocr_dependency_missing"],
            )
        except Exception as exc:  # noqa: BLE001 - keep image/OCR text out of logs and responses.
            return _build_response(
                request=request,
                provider=self.name,
                status="failed",
                text="",
                blocks=[],
                warnings=[f"rapidocr_failed:{exc.__class__.__name__}"],
            )

        text = "\n".join(block.text for block in blocks if block.text).strip()
        if int((perf_counter() - started_at) * 1000) > settings.local_ocr_slow_warning_millis:
            warnings.append("local_ocr_slow")

        return _build_response(
            request=request,
            provider=self.name,
            status="completed",
            text=text,
            blocks=blocks,
            warnings=warnings,
        )

    def _decode_image(self, image_base64: str) -> Any:
        image_bytes = base64.b64decode(image_base64, validate=True)
        with BytesIO(image_bytes) as buffer:
            with Image.open(buffer) as image:  # type: ignore[union-attr]
                image.load()
                rgb_image = image.convert("RGB")
                return np.array(rgb_image)  # type: ignore[union-attr]

    def _load_engine_class(self) -> Any:
        candidates = (
            ("rapidocr_onnxruntime", "RapidOCR"),
            ("rapidocr", "RapidOCR"),
        )
        errors: list[str] = []
        for module_name, class_name in candidates:
            try:
                module = importlib.import_module(module_name)
                return getattr(module, class_name)
            except Exception as exc:  # noqa: BLE001 - try next supported package.
                errors.append(f"{module_name}:{exc.__class__.__name__}")

        raise ImportError(";".join(errors) or "rapidocr module missing")

    def _parse_blocks(self, raw_result: Any) -> list[LocalOcrTextBlock]:
        records = self._extract_records(raw_result)
        blocks: list[LocalOcrTextBlock] = []

        for record in records:
            parsed = self._parse_record(record)
            if parsed is not None:
                blocks.append(parsed)

        return sorted(blocks, key=lambda block: (block.y, block.x))

    @staticmethod
    def _extract_records(raw_result: Any) -> list[Any]:
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

    @staticmethod
    def _parse_record(record: Any) -> LocalOcrTextBlock | None:
        if not isinstance(record, (list, tuple)) or len(record) < 2:
            return None

        box = record[0]
        text = str(record[1]).strip()
        score = float(record[2]) if len(record) > 2 and record[2] is not None else 0.0
        if not text:
            return None

        x, y, width, height = _box_to_bounds(box)
        return LocalOcrTextBlock(
            text=text,
            confidence=max(0.0, min(1.0, score)),
            x=x,
            y=y,
            width=width,
            height=height,
        )


class LocalOcrService:
    def __init__(self, settings: Settings | None = None, provider: LocalOcrProvider | None = None) -> None:
        self.settings = settings or get_settings()
        self.provider = provider or _create_provider(self.settings.local_ocr_provider)

    async def health(self) -> LocalOcrHealthResponse:
        warning = self.provider.check_available()
        return LocalOcrHealthResponse(
            available=warning is None,
            provider=self.provider.name,
            maxImageBytes=self.settings.local_ocr_max_image_bytes,
            maxWidth=self.settings.local_ocr_max_width,
            maxHeight=self.settings.local_ocr_max_height,
            warning=warning,
        )

    async def extract(self, request: LocalOcrExtractRequest) -> LocalOcrExtractResponse:
        image_base64 = _validate_and_extract_base64(request, self.settings)
        return self.provider.extract(request, image_base64, self.settings)


def get_local_ocr_service() -> LocalOcrService:
    return LocalOcrService()


def _create_provider(provider_name: str) -> LocalOcrProvider:
    normalized = provider_name.strip().lower()
    if normalized == "placeholder":
        return PlaceholderLocalOcrProvider()
    if normalized == "rapidocr":
        return RapidOcrLocalProvider()
    raise LocalOcrValidationError("Unsupported local OCR provider.")


def _validate_and_extract_base64(request: LocalOcrExtractRequest, settings: Settings) -> str:
    image = request.image
    if image.mimeType not in _SAFE_MIME_TYPES:
        raise LocalOcrValidationError("Unsupported image type.")
    if image.width <= 0 or image.width > settings.local_ocr_max_width:
        raise LocalOcrValidationError("Image width is not allowed.")
    if image.height <= 0 or image.height > settings.local_ocr_max_height:
        raise LocalOcrValidationError("Image height is not allowed.")
    if image.byteSize <= 0 or image.byteSize > settings.local_ocr_max_image_bytes:
        raise LocalOcrValidationError("Image payload is too large.")

    prefix = f"data:{image.mimeType};base64,"
    if not image.dataUrl.startswith(prefix):
        raise LocalOcrValidationError("Image data URL is invalid.")

    image_base64 = image.dataUrl[len(prefix) :]
    try:
        image_bytes = base64.b64decode(image_base64, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise LocalOcrValidationError("Image base64 payload is invalid.") from exc

    if len(image_bytes) != image.byteSize:
        raise LocalOcrValidationError("Image byte size mismatch.")
    if not _has_expected_magic_bytes(image.mimeType, image_bytes):
        raise LocalOcrValidationError("Image binary signature is invalid.")

    return image_base64


def _has_expected_magic_bytes(mime_type: str, image_bytes: bytes) -> bool:
    if mime_type == "image/jpeg":
        return len(image_bytes) >= 3 and image_bytes[:3] == b"\xff\xd8\xff"
    if mime_type == "image/png":
        return image_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/webp":
        return len(image_bytes) >= 12 and image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP"
    return False


def _build_response(
    request: LocalOcrExtractRequest,
    provider: str,
    status: str,
    text: str,
    blocks: list[LocalOcrTextBlock],
    warnings: list[str],
) -> LocalOcrExtractResponse:
    preview, preview_warnings = redact_sensitive_text(text, max_chars=240)
    all_warnings = [*warnings, *preview_warnings]
    return LocalOcrExtractResponse(
        requestId=request.commandId,
        provider=provider,
        status=status,  # type: ignore[arg-type]
        text=text,
        textFound=bool(text.strip()),
        textLength=len(text),
        preview=preview,
        width=request.image.width,
        height=request.image.height,
        mimeType=request.image.mimeType,
        byteSize=request.image.byteSize,
        blocks=blocks,
        warnings=all_warnings,
        extractedAt=datetime.now(timezone.utc).isoformat(),
    )


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
