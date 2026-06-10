from __future__ import annotations

from app.core.config import Settings
from app.screen_analysis.ollama_provider import OllamaScreenAnalysisProvider
from app.screen_analysis.placeholder_provider import PlaceholderScreenAnalysisProvider


def create_screen_analysis_provider(settings: Settings):
    provider = settings.screen_analysis_provider.strip().lower()
    if provider == "ollama":
        return OllamaScreenAnalysisProvider(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            timeout_seconds=settings.screen_analysis_timeout_seconds,
            temperature=settings.screen_analysis_temperature,
        )
    return PlaceholderScreenAnalysisProvider()
