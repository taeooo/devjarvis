from __future__ import annotations

from app.core.config import Settings, get_settings
from app.schemas.local_wake import LocalWakeHealthResponse, LocalWakeSessionResponse


class LocalWakeService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._listening = False

    async def health(self) -> LocalWakeHealthResponse:
        available = self.settings.wake_provider != "placeholder" and not self.settings.wake_paused
        return LocalWakeHealthResponse(
            available=available,
            listening=available and self._listening,
            paused=self.settings.wake_paused,
            warning=None if available else "Local wake word is not configured.",
            phraseHint=self.settings.wake_phrase_hint,
            maxSessionMillis=self.settings.wake_max_session_millis,
        )

    async def start_session(self) -> LocalWakeSessionResponse:
        if self.settings.wake_paused:
            return LocalWakeSessionResponse(status="paused", paused=True, warning="wake_word_paused")

        if self.settings.wake_provider == "placeholder":
            return LocalWakeSessionResponse(
                status="unavailable",
                listening=False,
                paused=False,
                warning="wake_word_provider_not_configured",
            )

        self._listening = True
        return LocalWakeSessionResponse(status="started", listening=True, paused=False)

    async def stop_session(self) -> LocalWakeSessionResponse:
        self._listening = False
        return LocalWakeSessionResponse(status="stopped", listening=False, paused=self.settings.wake_paused)


_WAKE_SERVICE: LocalWakeService | None = None


def get_local_wake_service() -> LocalWakeService:
    global _WAKE_SERVICE
    if _WAKE_SERVICE is None:
        _WAKE_SERVICE = LocalWakeService()
    return _WAKE_SERVICE
