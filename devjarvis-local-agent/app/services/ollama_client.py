from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import Settings
from app.schemas.local_llm import LocalLlmAnalyzeRequest, LocalLlmAnalyzeResponse, LocalLlmHealthResponse
from app.services.prompt_builder import build_local_llm_prompt
from app.services.text_sanitizer import redact_sensitive_text


class OllamaClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.base_url = settings.ollama_base_url.rstrip("/")

    async def health(self) -> LocalLlmHealthResponse:
        if not self.settings.ollama_model:
            return LocalLlmHealthResponse(
                available=False,
                model=None,
                baseUrl=self.base_url,
                warning="Ollama model is not configured.",
            )

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:  # noqa: BLE001
            return LocalLlmHealthResponse(
                available=False,
                model=self.settings.ollama_model,
                baseUrl=self.base_url,
                warning=f"Ollama is not available: {type(exc).__name__}",
            )

        models = payload.get("models", []) if isinstance(payload, dict) else []
        names = {item.get("name") for item in models if isinstance(item, dict)}
        return LocalLlmHealthResponse(
            available=self.settings.ollama_model in names,
            model=self.settings.ollama_model,
            baseUrl=self.base_url,
            warning=None if self.settings.ollama_model in names else "Configured model was not found in Ollama.",
        )

    async def analyze(self, request: LocalLlmAnalyzeRequest) -> LocalLlmAnalyzeResponse:
        if not self.settings.ollama_model:
            return LocalLlmAnalyzeResponse(
                status="failed",
                model=None,
                intent=request.intent,
                summary="Ollama model is not configured.",
                warnings=["ollama_model_missing"],
            )

        sanitized_text, warnings = redact_sensitive_text(request.text, self.settings.max_input_chars)
        sanitized_context = None
        if request.context:
            sanitized_context, context_warnings = redact_sensitive_text(request.context, self.settings.max_input_chars)
            warnings.extend(context_warnings)

        prompt = build_local_llm_prompt(request.intent, sanitized_text, sanitized_context)
        payload = {
            "model": self.settings.ollama_model,
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
                model=self.settings.ollama_model,
                intent=request.intent,
                summary=parsed.get("summary") or content[:500] or "Analysis completed.",
                detail=parsed.get("detail"),
                actionItems=self._as_string_list(parsed.get("actionItems")),
                warnings=warnings,
            )
        except Exception as exc:  # noqa: BLE001
            return LocalLlmAnalyzeResponse(
                status="failed",
                model=self.settings.ollama_model,
                intent=request.intent,
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
