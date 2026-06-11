from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import Settings
from app.schemas.local_llm import LocalLlmAnalyzeRequest, LocalLlmAnalyzeResponse, LocalLlmHealthResponse
from app.services.model_router import build_model_routing_snapshot, resolve_model_route
from app.services.prompt_builder import build_local_llm_prompt
from app.services.text_sanitizer import redact_sensitive_text


class OllamaClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.base_url = settings.ollama_base_url.rstrip("/")

    async def health(self) -> LocalLlmHealthResponse:
        routing = build_model_routing_snapshot(self.settings)
        configured_models = {model for model in routing.values() if model}

        if not configured_models:
            return LocalLlmHealthResponse(
                available=False,
                warning="Ollama model routing is not configured.",
            )

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:  # noqa: BLE001
            return LocalLlmHealthResponse(
                available=False,
                warning=f"Ollama is not available: {type(exc).__name__}",
            )

        models = payload.get("models", []) if isinstance(payload, dict) else []
        names = {item.get("name") for item in models if isinstance(item, dict)}
        all_models_ready = all(model in names for model in configured_models)
        return LocalLlmHealthResponse(
            available=all_models_ready,
            warning=None if all_models_ready else "One or more configured models were not found in Ollama.",
        )

    async def analyze(self, request: LocalLlmAnalyzeRequest) -> LocalLlmAnalyzeResponse:
        route = resolve_model_route(request.intent, self.settings)
        if not route.model:
            return LocalLlmAnalyzeResponse(
                status="failed",
                summary="Ollama model routing is not configured.",
                warnings=["ollama_model_missing"],
            )

        sanitized_text, warnings = redact_sensitive_text(request.text, self.settings.max_input_chars)
        sanitized_context = None
        if request.context:
            sanitized_context, context_warnings = redact_sensitive_text(request.context, self.settings.max_input_chars)
            warnings.extend(context_warnings)

        prompt = build_local_llm_prompt(request.intent, sanitized_text, sanitized_context)
        payload = {
            "model": route.model,
            "stream": False,
            "messages": [
                {"role": "user", "content": prompt},
            ],
            "options": {
                "temperature": self.settings.temperature,
                "num_predict": self.settings.max_output_tokens,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.settings.ollama_timeout_seconds) as client:
                response = await client.post(f"{self.base_url}/api/chat", json=payload)
                response.raise_for_status()
                raw = response.json()
            content = self._extract_content(raw)
            parsed = self._parse_model_json(content)
            return LocalLlmAnalyzeResponse(
                status="completed",
                summary=parsed.get("summary") or content[:500] or "Analysis completed.",
                detail=parsed.get("detail"),
                actionItems=self._as_string_list(parsed.get("actionItems")),
                warnings=warnings,
            )
        except Exception as exc:  # noqa: BLE001
            return LocalLlmAnalyzeResponse(
                status="failed",
                summary="Local LLM analysis failed.",
                detail=f"{type(exc).__name__}",
                warnings=[*warnings, "ollama_request_failed"],
            )

    @staticmethod
    def _extract_content(payload: dict[str, Any]) -> str:
        message = payload.get("message")
        if isinstance(message, dict) and isinstance(message.get("content"), str):
            return message["content"].strip()
        if isinstance(payload.get("response"), str):
            return payload["response"].strip()
        return ""

    @staticmethod
    def _parse_model_json(content: str) -> dict[str, Any]:
        if not content:
            return {}
        stripped = content.strip()
        if stripped.startswith("```"):
            stripped = stripped.strip("`")
            if stripped.lower().startswith("json"):
                stripped = stripped[4:].strip()
        try:
            parsed = json.loads(stripped)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {"summary": content[:1000]}

    @staticmethod
    def _as_string_list(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item) for item in value if str(item).strip()]
