from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.responses import ApiResponse


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        response = ApiResponse.fail(
            code="VALIDATION_ERROR",
            message=str(exc.errors()),
        )
        return JSONResponse(status_code=422, content=response.model_dump(mode="json"))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(
        _request: Request,
        exc: Exception,
    ) -> JSONResponse:
        response = ApiResponse.fail(
            code="INTERNAL_SERVER_ERROR",
            message=str(exc),
        )
        return JSONResponse(status_code=500, content=response.model_dump(mode="json"))
