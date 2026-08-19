import asyncio
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError, OperationalError, TimeoutError as SATimeoutError

from app.api.v1.router import api_router
from app.config import get_settings
from app.core.background_queue import background_queue
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
    {
        "name": "admin",
        "description": "Platform admin portal: cross-workspace/user management (PlatformStaff only).",
    },
]


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    await warmup_database()
    await background_queue.start()
    try:
        yield
    finally:
        await background_queue.stop()


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
    return get_settings().browser_cors_origins


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
                    "message": "Database query timed out. Please try again.",
                    "code": "DB_TIMEOUT",
                }
            },
        )
    except (OperationalError, SATimeoutError) as exc:
        msg = str(exc).lower()
        if "statement timeout" in msg or "canceling statement" in msg:
            return JSONResponse(
                status_code=503,
                content={
                    "error": {
                        "message": "Query exceeded execution time limit.",
                        "code": "DB_STATEMENT_TIMEOUT",
                    }
                },
            )
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "message": "Database service temporarily unavailable.",
                    "code": "DB_UNAVAILABLE",
                }
            },
        )


@fastapi_app.exception_handler(AppError)
async def _app_error_handler(_request: Request, exc: AppError):
    return app_error_to_http(exc)


@fastapi_app.exception_handler(RequestValidationError)
async def _validation_error_handler(_request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = errors[0]["msg"] if errors else "Invalid request data"
    return JSONResponse(
        status_code=400,
        content={"error": {"message": msg, "code": "VALIDATION_ERROR", "details": errors}},
    )


fastapi_app.include_router(api_router, prefix="/api/v1")


@fastapi_app.get("/health", tags=["meta"])
async def health_check():
    return {"status": "ok", "service": "kinetix-api-py"}


@fastapi_app.get("/", include_in_schema=False)
async def root_redirect():
    return RedirectResponse(url="/docs")


from app.socket import create_asgi_app

app = create_asgi_app(fastapi_app)




