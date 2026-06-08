import asyncio
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, OperationalError, TimeoutError as SATimeoutError

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.errors import AppError, app_error_to_http
from app.db.session import get_engine, warmup_database
from app.services import email_service

OPENAPI_TAGS = [
    {
        "name": "auth",
        "description": "Sign up, login, refresh cookies, password reset.",
    },
    {
        "name": "workspaces",
        "description": "Workspace CRUD and members (Bearer token required).",
    },
    {
        "name": "invites",
        "description": "Invite preview and accept flows.",
    },
    {
        "name": "home",
        "description": "Home inbox, tasks, spaces, posts (workspace member).",
    },
    {
        "name": "chat",
        "description": "Chat channels, DMs, messages, threads (workspace member).",
    },
    {"name": "meta", "description": "API index and metadata."},
]

@asynccontextmanager
async def _lifespan(_app: FastAPI):
    await warmup_database()
    yield


fastapi_app = FastAPI(
    title="Kinetix API",
    version="0.2.0-py",
    description=(
        "Kinetix backend (Python/FastAPI). Same contract as the Express API.\n\n"
        "**Interactive docs:** use [Swagger UI](/docs) to try endpoints.\n\n"
        "**Auth:** click **Authorize** and paste `Bearer <accessToken>` from login."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    openapi_tags=OPENAPI_TAGS,
    lifespan=_lifespan,
)

def _cors_origins() -> list[str]:
    base = get_settings().frontend_url.rstrip("/")
    origins = {base}
    if "localhost" in base:
        origins.add(base.replace("localhost", "127.0.0.1"))
    if "127.0.0.1" in base:
        origins.add(base.replace("127.0.0.1", "localhost"))
    return sorted(origins)


fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@fastapi_app.middleware("http")
async def _database_timeout_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except (asyncio.CancelledError, TimeoutError):
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "DATABASE_UNAVAILABLE",
                    "message": "Database is temporarily unavailable. Please retry.",
                }
            },
        )


def custom_openapi():
    if fastapi_app.openapi_schema:
        return fastapi_app.openapi_schema
    schema = get_openapi(
        title=fastapi_app.title,
        version=fastapi_app.version,
        description=fastapi_app.description,
        routes=fastapi_app.routes,
        tags=OPENAPI_TAGS,
    )
    schema.setdefault("components", {}).setdefault("securitySchemes", {})[
        "BearerAuth"
    ] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Access token from POST /api/v1/auth/login",
    }
    fastapi_app.openapi_schema = schema
    return fastapi_app.openapi_schema


fastapi_app.openapi = custom_openapi


@fastapi_app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError):
    http_exc = app_error_to_http(exc)
    return JSONResponse(
        status_code=http_exc.status_code,
        content=http_exc.detail,
    )


@fastapi_app.exception_handler(RequestValidationError)
async def validation_handler(_request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    message = first.get("msg", "Invalid body")
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "VALIDATION_ERROR", "message": message}},
    )


def _is_database_unavailable(exc: BaseException) -> bool:
    if isinstance(exc, (TimeoutError, asyncio.CancelledError, SATimeoutError)):
        return True
    if isinstance(exc, (OperationalError, DBAPIError)):
        return True
    cause = getattr(exc, "__cause__", None)
    if cause and _is_database_unavailable(cause):
        return True
    msg = str(exc).lower()
    return any(
        token in msg
        for token in (
            "timeout",
            "timed out",
            "connection",
            "cancelled",
            "pool",
            "asyncpg",
            "prepared statement",
        )
    )


@fastapi_app.exception_handler(OperationalError)
async def db_operational_handler(_request: Request, exc: OperationalError):
    print(exc)
    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "DATABASE_UNAVAILABLE",
                "message": "Database is temporarily unavailable. Please retry.",
            }
        },
    )


@fastapi_app.exception_handler(Exception)
async def unhandled_handler(_request: Request, exc: Exception):
    print(exc)
    if _is_database_unavailable(exc):
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "DATABASE_UNAVAILABLE",
                    "message": "Database is temporarily unavailable. Please retry.",
                }
            },
        )
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "Something went wrong"}},
    )


@fastapi_app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")


fastapi_app.include_router(api_router, prefix="/api/v1")


def _registered_paths() -> set[str]:
    return {getattr(route, "path", "") for route in fastapi_app.routes}


@fastapi_app.get("/health", tags=["meta"])
async def health():
    db_ok = False
    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        db_ok = False
    paths = _registered_paths()
    google_routes = {
        "start": "/api/v1/auth/google/start" in paths,
        "callback": "/api/v1/auth/google/callback" in paths,
    }
    return {
        "status": "ok" if db_ok else "degraded",
        "phase": "PY-5-realtime",
        "build": "google-oauth-v1",
        "runtime": "fastapi",
        "database": "connected" if db_ok else "unavailable",
        "docs": "/docs",
        "smtp": {
            "configured": email_service.is_smtp_configured(),
            "host": get_settings().smtp_host or None,
        },
        "googleOAuth": {
            "routesRegistered": all(google_routes.values()),
            "configured": get_settings().google_oauth_enabled,
            "redirectUri": get_settings().google_redirect_uri,
            "apiPublicUrl": get_settings().api_public_url,
        },
    }

from app.socket.server import create_asgi_app  # noqa: E402

app = create_asgi_app(fastapi_app)


def run():
    s = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=s.port,
        reload=s.node_env != "production",
    )


if __name__ == "__main__":
    run()
