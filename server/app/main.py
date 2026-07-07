import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.types import Scope

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import AppError, to_http_exception
from app.core.logging import get_logger, setup_logging
from app.db.database import close_db, init_db

setup_logging()
logger = get_logger(__name__)


# ── CORS-aware StaticFiles ─────────────────────────────────────────────────────
#
# Starlette's app.mount() vytvoří sub-aplikaci, která OBCHÁZÍ CORSMiddleware
# nastavenou na hlavní app. Proto CORS hlavičky přidáváme přímo v metodě
# get_response() a navíc zpracujeme OPTIONS preflight ručně.
#
class CORSStaticFiles(StaticFiles):
    _CORS_HEADERS = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
    }

    async def get_response(self, path: str, scope: Scope) -> Response:
        # Preflight OPTIONS – StaticFiles to neumí, vyřídíme sami
        if scope["method"] == "OPTIONS":
            return Response(status_code=204, headers=self._CORS_HEADERS)

        response = await super().get_response(path, scope)

        # Přidáme CORS hlavičky – přímé přiřazení, ne setdefault,
        # aby přepsalo i případné hlavičky z předchozích vrstev.
        for key, value in self._CORS_HEADERS.items():
            response.headers[key] = value

        return response


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(
        "app_starting",
        version=settings.APP_VERSION,
        env=settings.ENVIRONMENT,
        base_url=settings.effective_base_url,
        upload_dir=str(settings.UPLOAD_DIR),
    )
    await init_db()
    yield
    logger.info("app_shutting_down")
    await close_db()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Musí být přidán PŘED routery. CORSMiddleware pokrývá /api/** a /health,
# ale NE mountované sub-aplikace (jako /files). Ty mají vlastní CORS výše.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Statické soubory ──────────────────────────────────────────────────────────
# Veřejný endpoint /files/{filename} – BEZ autentizace.
# <audio> element nemůže posílat Authorization hlavičky, proto musí být
# audio soubory dostupné bez tokenu. Bezpečnost = soubory mají náhodná UUID jména.
app.mount(
    "/files",
    CORSStaticFiles(directory=str(settings.UPLOAD_DIR)),
    name="files",
)


# ── Request logging ───────────────────────────────────────────────────────────
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start = time.perf_counter()
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        method=request.method,
        path=request.url.path,
        client=str(request.client.host) if request.client else "unknown",
    )
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info("http_request", status_code=response.status_code, elapsed_ms=round(elapsed_ms, 2))
    return response


# ── Exception handlers ────────────────────────────────────────────────────────
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    http_exc = to_http_exception(exc)
    return JSONResponse(status_code=http_exc.status_code, content={"detail": http_exc.detail})


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_exception", error=str(exc))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": {"code": "INTERNAL_ERROR", "message": "Interní chyba serveru."}},
    )


# ── Routery ───────────────────────────────────────────────────────────────────
app.include_router(api_router)


# ── Veřejné endpointy ─────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {"status": "ok", "version": settings.APP_VERSION}


@app.get("/api/v1/server-info", tags=["info"])
async def server_info() -> dict:
    return {
        "base_url": settings.effective_base_url,
        "version": settings.APP_VERSION,
        "app_name": settings.APP_NAME,
    }