from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.responses import ApiResponse


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request,
        _exc: RequestValidationError,
    ) -> JSONResponse:
        response = ApiResponse.fail(
            code="VALIDATION_ERROR",
            message="Request validation failed.",
        )
        return JSONResponse(status_code=422, content=response.model_dump(mode="json"))

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(
        _request: Request,
        exc: StarletteHTTPException,
    ) -> JSONResponse:
        response = ApiResponse.fail(
            code="REQUEST_REJECTED",
            message=str(exc.detail),
        )
        return JSONResponse(status_code=exc.status_code, content=response.model_dump(mode="json"))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(
        _request: Request,
        _exc: Exception,
    ) -> JSONResponse:
        response = ApiResponse.fail(
            code="LOCAL_AGENT_ERROR",
            message="DevJarvis Local Agent request failed.",
        )
        return JSONResponse(status_code=500, content=response.model_dump(mode="json"))
