import base64
import importlib
from io import BytesIO
from time import perf_counter
from typing import Any

from app.ocr.provider import OcrProvider
from app.schemas.ocr import OcrExtractRequest, OcrExtractResponse, OcrImageSummary, OcrTextBlock

try:
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = 20_000_000
except Exception:  # noqa: BLE001 - optional dependency is reported safely at runtime.
    Image = None  # type: ignore[assignment]

try:
    import numpy as np
except Exception:  # noqa: BLE001 - optional dependency is reported safely at runtime.
    np = None  # type: ignore[assignment]


class RapidOcrProvider(OcrProvider):
    """RapidOCR provider with lazy optional dependency loading.

    The provider intentionally does not write the source image to disk. The image is decoded
    in memory and passed to the OCR engine as an RGB numpy array.
    """

    def __init__(self, engine: Any | None = None) -> None:
        self._engine = engine

    def extract(self, request: OcrExtractRequest) -> OcrExtractResponse:
        started_at = perf_counter()
        image_summary = OcrImageSummary(
            width=request.width,
            height=request.height,
            mimeType=request.mime_type,
            byteSize=request.byte_size,
        )

        if Image is None or np is None:
            return self._failed_response(
                request=request,
                image_summary=image_summary,
                started_at=started_at,
                warning="RapidOCR provider requires Pillow and numpy. Install requirements.txt and restart the AI server.",
            )

        try:
            image_array = self._decode_image(request.image_base64)
            engine = self._engine or self._load_engine()
            raw_result = engine(image_array)
            blocks = self._parse_blocks(raw_result)
        except ImportError as exc:
            return self._failed_response(
                request=request,
                image_summary=image_summary,
                started_at=started_at,
                warning=str(exc),
            )
        except Exception as exc:  # noqa: BLE001 - expose safe OCR failure only.
            return self._failed_response(
                request=request,
                image_summary=image_summary,
                started_at=started_at,
                warning=f"RapidOCR extraction failed: {exc.__class__.__name__}",
            )

        text = "\n".join(block.text for block in blocks if block.text).strip()
        confidence = self._average_confidence(blocks)
        elapsed_millis = int((perf_counter() - started_at) * 1000)

        return OcrExtractResponse(
            requestId=request.request_id,
            provider="rapidocr",
            status="completed",
            text=text,
            textFound=bool(text),
            language=None,
            confidence=confidence,
            blocks=blocks,
            image=image_summary,
            warnings=[],
            elapsedMillis=elapsed_millis,
        )

    def _decode_image(self, image_base64: str) -> Any:
        image_bytes = base64.b64decode(image_base64, validate=True)
        with BytesIO(image_bytes) as buffer:
            with Image.open(buffer) as image:  # type: ignore[union-attr]
                image.load()
                rgb_image = image.convert("RGB")
                return np.array(rgb_image)  # type: ignore[union-attr]

    def _load_engine(self) -> Any:
        # Prefer the legacy onnxruntime package because it has the smallest integration surface.
        # Keep import dynamic so placeholder/local tests do not require heavy OCR dependencies.
        candidates = (
            ("rapidocr_onnxruntime", "RapidOCR"),
            ("rapidocr", "RapidOCR"),
        )
        errors: list[str] = []
        for module_name, class_name in candidates:
            try:
                module = importlib.import_module(module_name)
                engine_class = getattr(module, class_name)
                return engine_class()
            except Exception as exc:  # noqa: BLE001 - try next compatible package.
                errors.append(f"{module_name}: {exc.__class__.__name__}")

        raise ImportError(
            "RapidOCR dependency is not available. Install rapidocr-onnxruntime or rapidocr. "
            + "; ".join(errors)
        )

    def _parse_blocks(self, raw_result: Any) -> list[OcrTextBlock]:
        records = self._extract_records(raw_result)
        blocks: list[OcrTextBlock] = []

        for record in records:
            parsed = self._parse_record(record)
            if parsed is not None:
                blocks.append(parsed)

        return sorted(blocks, key=lambda block: (block.y, block.x))

    def _extract_records(self, raw_result: Any) -> list[Any]:
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

    def _parse_record(self, record: Any) -> OcrTextBlock | None:
        if not isinstance(record, (list, tuple)) or len(record) < 2:
            return None

        box = record[0]
        text = str(record[1]).strip()
        score = float(record[2]) if len(record) > 2 and record[2] is not None else 0.0
        if not text:
            return None

        x, y, width, height = self._box_to_bounds(box)
        return OcrTextBlock(
            text=text,
            confidence=max(0.0, min(1.0, score)),
            x=x,
            y=y,
            width=width,
            height=height,
        )

    def _box_to_bounds(self, box: Any) -> tuple[int, int, int, int]:
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

    def _average_confidence(self, blocks: list[OcrTextBlock]) -> float | None:
        if not blocks:
            return None
        return round(sum(block.confidence for block in blocks) / len(blocks), 4)

    def _failed_response(
        self,
        request: OcrExtractRequest,
        image_summary: OcrImageSummary,
        started_at: float,
        warning: str,
    ) -> OcrExtractResponse:
        elapsed_millis = int((perf_counter() - started_at) * 1000)
        return OcrExtractResponse(
            requestId=request.request_id,
            provider="rapidocr",
            status="failed",
            text="",
            textFound=False,
            language=None,
            confidence=None,
            blocks=[],
            image=image_summary,
            warnings=[warning],
            elapsedMillis=elapsed_millis,
        )
