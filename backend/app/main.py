import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response

from .config import get_settings, validate_settings
from .logging_setup import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    validate_settings(get_settings())
    yield


def create_app() -> FastAPI:
    fastapi_app = FastAPI(lifespan=lifespan)

    @fastapi_app.middleware("http")
    async def log_request(request: Request, call_next):
        start = time.perf_counter()
        response: Response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response

    @fastapi_app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return fastapi_app


app = create_app()
