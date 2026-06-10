from app.core.config import Settings
from app.services.model_router import build_model_routing_snapshot, resolve_model_route


def test_resolve_code_intent_to_code_model() -> None:
    settings = Settings(
        default_model="qwen3:8b",
        code_model="qwen2.5-coder:7b",
        translation_model="qwen3:8b",
        reasoning_model="qwen3:8b",
        fallback_model="qwen3:8b",
    )

    route = resolve_model_route("screen_error_analysis", settings)

    assert route.role == "code"
    assert route.model == "qwen2.5-coder:7b"


def test_resolve_translation_intent_to_translation_model() -> None:
    settings = Settings(
        default_model="qwen3:8b",
        translation_model="llama3.1:8b",
        fallback_model="qwen3:8b",
    )

    route = resolve_model_route("screen_translate", settings)

    assert route.role == "translation"
    assert route.model == "llama3.1:8b"


def test_model_routing_snapshot_uses_backward_compatible_ollama_model() -> None:
    settings = Settings(ollama_model="legacy-model")

    snapshot = build_model_routing_snapshot(settings)

    assert snapshot["default"] == "legacy-model"
    assert snapshot["code"] == "legacy-model"
    assert snapshot["fallback"] == "legacy-model"
