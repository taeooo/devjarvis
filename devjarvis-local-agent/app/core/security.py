from ipaddress import ip_address
from typing import Iterable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import Settings


_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1", "testclient"}


def is_loopback_client(host: str | None) -> bool:
    if not host:
        return False
    if host in _LOOPBACK_HOSTS:
        return True
    try:
        return ip_address(host).is_loopback
    except ValueError:
        return False


def is_loopback_host_header(host_header: str | None, allowed_hosts: Iterable[str] = _LOOPBACK_HOSTS) -> bool:
    if not host_header:
        return False
    host = host_header.split(":", 1)[0].strip().lower()
    return host in set(allowed_hosts)


class LoopbackOnlyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
        if not self.settings.require_loopback:
            return await call_next(request)

        client_host = request.client.host if request.client else None
        host_header = request.headers.get("host")

        if is_loopback_client(client_host) and is_loopback_host_header(host_header):
            return await call_next(request)

        return JSONResponse(
            status_code=403,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "LOCAL_AGENT_LOOPBACK_ONLY",
                    "message": "DevJarvis Local Agent accepts loopback requests only.",
                },
            },
        )
