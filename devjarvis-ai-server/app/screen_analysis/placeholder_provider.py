from __future__ import annotations

from time import perf_counter

from app.schemas.screen_analysis import ScreenAnalysisRequest, ScreenAnalysisResponse

_MAX_DETAIL_CHARS = 1400
_MAX_ACTION_ITEMS = 4


class PlaceholderScreenAnalysisProvider:
    name = "screen-analysis-placeholder"

    def analyze(
        self,
        request: ScreenAnalysisRequest,
        text: str,
        warnings: list[str] | None = None,
    ) -> ScreenAnalysisResponse:
        started_at = perf_counter()
        result_warnings = list(warnings or [])

        if not request.ocr_text_found or not text:
            result_warnings.append("OCR text was empty. Screen analysis is waiting for readable text.")

        title, summary, detail, action_items = _build_placeholder_result(request.intent, text)
        elapsed_millis = int((perf_counter() - started_at) * 1000)

        return ScreenAnalysisResponse(
            requestId=request.request_id,
            provider=self.name,
            status="analysis_ready" if text else "no_text",
            intent=request.intent,
            title=title,
            summary=summary,
            detail=detail,
            actionItems=action_items[:_MAX_ACTION_ITEMS],
            textUsedLength=len(text),
            warnings=result_warnings,
            elapsedMillis=elapsed_millis,
        )


def _build_placeholder_result(intent: str, text: str) -> tuple[str, str, str, list[str]]:
    if intent == "screen_translate":
        return (
            "Screen translation pipeline ready",
            "OCR text was extracted and is ready for translation provider routing.",
            _build_detail(
                "Translation provider is not connected yet. The OCR text below is the sanitized input that will be passed to the next LLM or translation provider.",
                text,
            ),
            [
                "Connect a local LLM or translation provider.",
                "Keep OCR text length limits before provider calls.",
                "Do not log the raw screen text in production logs.",
            ],
        )

    if intent == "screen_summary":
        return (
            "Screen summary pipeline ready",
            "OCR text was extracted and is ready for summarization provider routing.",
            _build_detail(
                "Summarization provider is not connected yet. The OCR text below is the sanitized input that will be summarized in the next stage.",
                text,
            ),
            [
                "Connect a screen summarization provider.",
                "Use concise result formatting for tray notifications.",
                "Store only bounded result previews in the UI.",
            ],
        )

    if intent == "screen_error_analysis":
        return (
            "Screen diagnosis pipeline ready",
            "OCR text was extracted and is ready for error diagnosis routing.",
            _build_detail(
                "Diagnosis provider is not connected yet. The OCR text below is the sanitized input that will be combined with project context or RAG later.",
                text,
            ),
            [
                "Connect project context and RAG before final diagnosis.",
                "Detect stack traces, error codes, and file references from OCR text.",
                "Return uncertainty when the screen text is incomplete.",
            ],
        )

    return (
        "Screen analysis pipeline ready",
        "OCR text was extracted and is ready for the next analysis provider.",
        _build_detail(
            "A specialized analysis provider is not connected yet. The OCR text below is the sanitized input for the next stage.",
            text,
        ),
        [
            "Route by command intent.",
            "Apply provider-specific input limits.",
            "Keep raw input out of logs.",
        ],
    )


def _build_detail(prefix: str, text: str) -> str:
    if not text:
        return prefix

    preview = text[:_MAX_DETAIL_CHARS].strip()
    if len(text) > _MAX_DETAIL_CHARS:
        preview += "…"
    return f"{prefix}\n\nOCR Preview:\n{preview}"
