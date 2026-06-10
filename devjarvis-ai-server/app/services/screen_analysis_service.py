from app.core.config import get_settings
from app.schemas.screen_analysis import ScreenAnalysisRequest, ScreenAnalysisResponse
from app.screen_analysis.placeholder_provider import PlaceholderScreenAnalysisProvider
from app.screen_analysis.provider_factory import create_screen_analysis_provider
from app.screen_analysis.prompt_builder import sanitize_screen_text


class ScreenAnalysisValidationError(ValueError):
    pass


def analyze_screen(request: ScreenAnalysisRequest) -> ScreenAnalysisResponse:
    settings = get_settings()
    sanitized = sanitize_screen_text(request.ocr_text, settings.screen_analysis_max_input_chars)
    warnings = list(sanitized.warnings)

    try:
        provider = create_screen_analysis_provider(settings)
        return provider.analyze(request, sanitized.text, warnings)
    except Exception:
        warnings.append("Configured screen analysis provider failed. Placeholder response was returned.")
        return PlaceholderScreenAnalysisProvider().analyze(request, sanitized.text, warnings)
