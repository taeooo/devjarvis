from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.local_llm import router as local_llm_router
from app.core.config import get_settings
from app.core.security import LoopbackOnlyMiddleware


def create_app() -> FastAPI:
    settings = get_settings()

    if settings.require_loopback and not settings.is_loopback_host():
        raise RuntimeError("DevJarvis Local Agent must be bound to a loopback host by default.")

    app = FastAPI(
        title="DevJarvis Local Agent",
        version=settings.app_version,
        description="Local-only runtime gateway for DevJarvis Desktop.",
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url="/redoc" if settings.enable_docs else None,
    )

    app.add_middleware(LoopbackOnlyMiddleware, settings=settings)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(local_llm_router)
    return app


app = create_app()
