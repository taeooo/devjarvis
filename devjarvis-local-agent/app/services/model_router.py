from dataclasses import dataclass

from app.core.config import Settings
from app.schemas.local_llm import LocalLlmIntent


@dataclass(frozen=True)
class ModelRoute:
    intent: LocalLlmIntent
    role: str
    model: str | None
    fallbackModel: str | None


_INTENT_MODEL_ROLES: dict[str, str] = {
    "screen_translate": "translation",
    "screen_summary": "reasoning",
    "screen_error_analysis": "code",
    "screen_math_solver": "reasoning",
    "project_diagnosis": "code",
    "log_analysis": "code",
    "general_chat": "default",
}


def resolve_model_route(intent: LocalLlmIntent, settings: Settings) -> ModelRoute:
    role = _INTENT_MODEL_ROLES.get(intent, "default")
    model = _resolve_model_for_role(role, settings)
    fallback = settings.fallback_model or settings.default_model or settings.ollama_model or None

    return ModelRoute(
        intent=intent,
        role=role,
        model=model or fallback,
        fallbackModel=fallback,
    )


def build_model_routing_snapshot(settings: Settings) -> dict[str, str | None]:
    return {
        "default": settings.default_model or settings.ollama_model or None,
        "code": settings.code_model or settings.default_model or settings.ollama_model or None,
        "translation": settings.translation_model or settings.default_model or settings.ollama_model or None,
        "reasoning": settings.reasoning_model or settings.default_model or settings.ollama_model or None,
        "fallback": settings.fallback_model or settings.default_model or settings.ollama_model or None,
    }


def _resolve_model_for_role(role: str, settings: Settings) -> str | None:
    if role == "code":
        return settings.code_model or settings.default_model or settings.ollama_model or None
    if role == "translation":
        return settings.translation_model or settings.default_model or settings.ollama_model or None
    if role == "reasoning":
        return settings.reasoning_model or settings.default_model or settings.ollama_model or None
    return settings.default_model or settings.ollama_model or None
