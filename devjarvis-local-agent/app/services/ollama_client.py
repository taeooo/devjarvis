from __future__ import annotations

import json
import re
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
            summary = self._as_optional_string(parsed.get("summary")) or self._fallback_summary(content)
            detail = self._as_optional_string(parsed.get("detail"))
            return LocalLlmAnalyzeResponse(
                status="completed",
                summary=summary,
                detail=detail,
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

    @classmethod
    def _parse_model_json(cls, content: str) -> dict[str, Any]:
        if not content:
            return {}

        candidate = cls._normalize_model_json_candidate(content)
        if not candidate:
            return {}

        try:
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}

    @classmethod
    def _normalize_model_json_candidate(cls, content: str) -> str:
        stripped = cls._strip_thinking_blocks(content).strip()
        if stripped.startswith("```"):
            stripped = stripped.strip("`")
            if stripped.lower().startswith("json"):
                stripped = stripped[4:].strip()

        direct = stripped.strip()
        if direct.startswith("{") and direct.endswith("}"):
            return direct

        extracted = cls._extract_first_json_object(direct)
        return extracted or direct

    @staticmethod
    def _strip_thinking_blocks(content: str) -> str:
        return re.sub(r"<think>.*?</think>", "", content, flags=re.IGNORECASE | re.DOTALL)

    @staticmethod
    def _extract_first_json_object(content: str) -> str | None:
        start = content.find("{")
        if start < 0:
            return None

        depth = 0
        in_string = False
        escaped = False
        for index, char in enumerate(content[start:], start=start):
            if in_string:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    in_string = False
                continue

            if char == '"':
                in_string = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return content[start:index + 1]

        return None

    @staticmethod
    def _as_optional_string(value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return json.dumps(value, ensure_ascii=False)

    @staticmethod
    def _fallback_summary(content: str) -> str:
        normalized = OllamaClient._strip_thinking_blocks(content).strip()
        return normalized[:500] or "Analysis completed."

    @staticmethod
    def _as_string_list(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item) for item in value if str(item).strip()]
