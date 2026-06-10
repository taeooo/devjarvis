from __future__ import annotations

import json
from collections.abc import Callable
from time import perf_counter
from typing import Any

import httpx

from app.schemas.screen_analysis import ScreenAnalysisRequest, ScreenAnalysisResponse
from app.screen_analysis.prompt_builder import build_screen_analysis_messages

_MAX_FIELD_CHARS = {
    "title": 90,
    "summary": 360,
    "detail": 1800,
}
_MAX_ACTION_ITEMS = 4


class OllamaScreenAnalysisProvider:
    name = "ollama-screen-analysis"

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        timeout_seconds: float,
        temperature: float,
        client_factory: Callable[[float], httpx.Client] | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model.strip()
        self._timeout_seconds = timeout_seconds
        self._temperature = temperature
        self._client_factory = client_factory or (lambda timeout: httpx.Client(timeout=timeout))

    def analyze(
        self,
        request: ScreenAnalysisRequest,
        text: str,
        warnings: list[str] | None = None,
    ) -> ScreenAnalysisResponse:
        started_at = perf_counter()
        result_warnings = list(warnings or [])

        if not text:
            elapsed_millis = int((perf_counter() - started_at) * 1000)
            return ScreenAnalysisResponse(
                requestId=request.request_id,
                provider=self.name,
                status="no_text",
                intent=request.intent,
                title="No readable screen text",
                summary="OCR did not return readable text for screen analysis.",
                detail="Try selecting a clearer window or screen region before running analysis again.",
                actionItems=["Select the target screen or window again.", "Check OCR result quality."],
                textUsedLength=0,
                warnings=result_warnings,
                elapsedMillis=elapsed_millis,
            )

        if not self._model:
            result_warnings.append("Ollama model is not configured.")
            return self._failed_response(request, text, result_warnings, started_at)

        try:
            content = self._call_ollama(request, text)
            parsed = _parse_llm_content(content)
            elapsed_millis = int((perf_counter() - started_at) * 1000)
            return ScreenAnalysisResponse(
                requestId=request.request_id,
                provider=self.name,
                status="completed",
                intent=request.intent,
                title=parsed["title"],
                summary=parsed["summary"],
                detail=parsed["detail"],
                actionItems=parsed["actionItems"],
                textUsedLength=len(text),
                warnings=result_warnings,
                elapsedMillis=elapsed_millis,
            )
        except Exception:
            result_warnings.append("Local LLM analysis failed. Check Ollama server/model availability.")
            return self._failed_response(request, text, result_warnings, started_at)

    def _call_ollama(self, request: ScreenAnalysisRequest, text: str) -> str:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": build_screen_analysis_messages(request.intent, request.context_mode, text),
            "stream": False,
            "format": "json",
            "options": {
                "temperature": self._temperature,
            },
        }
        with self._client_factory(self._timeout_seconds) as client:
            response = client.post(f"{self._base_url}/api/chat", json=payload)
            response.raise_for_status()
            body = response.json()

        message = body.get("message") if isinstance(body, dict) else None
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            return message["content"]
        if isinstance(body, dict) and isinstance(body.get("response"), str):
            return body["response"]
        raise ValueError("Unexpected Ollama response format.")

    def _failed_response(
        self,
        request: ScreenAnalysisRequest,
        text: str,
        warnings: list[str],
        started_at: float,
    ) -> ScreenAnalysisResponse:
        elapsed_millis = int((perf_counter() - started_at) * 1000)
        return ScreenAnalysisResponse(
            requestId=request.request_id,
            provider=self.name,
            status="failed",
            intent=request.intent,
            title="Screen analysis failed",
            summary="Local LLM analysis could not be completed.",
            detail="The OCR text was prepared, but the local analysis provider did not return a valid response.",
            actionItems=["Confirm Ollama is running.", "Confirm the configured model is installed.", "Retry with a smaller screen selection."],
            textUsedLength=len(text),
            warnings=warnings,
            elapsedMillis=elapsed_millis,
        )


def _parse_llm_content(content: str) -> dict[str, Any]:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError:
        value = {
            "title": "Screen analysis result",
            "summary": _truncate(cleaned, _MAX_FIELD_CHARS["summary"]),
            "detail": _truncate(cleaned, _MAX_FIELD_CHARS["detail"]),
            "actionItems": [],
        }

    if not isinstance(value, dict):
        value = {}

    title = _truncate(_as_text(value.get("title")) or "Screen analysis result", _MAX_FIELD_CHARS["title"])
    summary = _truncate(_as_text(value.get("summary")) or "Analysis completed.", _MAX_FIELD_CHARS["summary"])
    detail = _truncate(_as_text(value.get("detail")) or summary, _MAX_FIELD_CHARS["detail"])
    action_items = value.get("actionItems")
    if not isinstance(action_items, list):
        action_items = value.get("action_items")
    if not isinstance(action_items, list):
        action_items = []

    safe_items = [_truncate(_as_text(item), 180) for item in action_items]
    safe_items = [item for item in safe_items if item]

    return {
        "title": title,
        "summary": summary,
        "detail": detail,
        "actionItems": safe_items[:_MAX_ACTION_ITEMS],
    }


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\u0000", " ").strip()


def _truncate(value: str, max_chars: int) -> str:
    normalized = " ".join(value.split()).strip()
    if len(normalized) <= max_chars:
        return normalized
    return normalized[: max_chars - 1].rstrip() + "…"
