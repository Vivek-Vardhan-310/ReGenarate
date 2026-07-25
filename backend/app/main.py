"""
FastAPI Application Entry Point.

Initializes the FastAPI application, registers API routers,
configures middleware (CORS & GZip compression), and sets up exception handling.

Per Architecture (docs/02-Architecture.md, Section 33) & API Spec (docs/07-API.md, Section 10):
- GZip response compression for payloads > 1000 bytes.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.api.health import router as health_router
from app.api.routes import router as api_router
from app.config.constants import ERROR_CODES, SERVICE_NAME, SERVICE_VERSION
from app.config.settings import settings
from app.utils.exceptions import AppBaseError
from app.utils.logger import logger


# ==========================================
# Application Lifespan
# ==========================================

@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    """
    Manages application startup and shutdown events.
    """
    logger.info("=" * 60)
    logger.info(f"Starting {SERVICE_NAME} v{SERVICE_VERSION}")
    logger.info(f"Environment: {settings.APP_ENV}")
    logger.info(f"Debug Mode: {settings.DEBUG}")
    logger.info(f"AI Model: {settings.MODEL_NAME}")
    logger.info(f"Host: {settings.HOST}:{settings.PORT}")
    logger.info("=" * 60)

    if not settings.GROQ_API_KEY:
        logger.warning(
            "GROQ_API_KEY is not configured. "
            "AI endpoints will not function until a valid key is provided."
        )

    yield

    logger.info(f"Shutting down {SERVICE_NAME}.")


# ==========================================
# FastAPI Application
# ==========================================

app = FastAPI(
    title=SERVICE_NAME,
    version=SERVICE_VERSION,
    description=(
        "An AI-powered web application that reviews source code, "
        "identifies issues, and generates improved implementations "
        "using Large Language Models."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ==========================================
# Middleware Configuration
# ==========================================

# GZip Compression Middleware (Compress responses > 1000 bytes)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Exception Handlers
# ==========================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Handles Pydantic validation errors with 400 Bad Request."""
    errors = exc.errors()
    first_error_msg = errors[0].get("msg", "Invalid request payload.") if errors else "Invalid request payload."
    if first_error_msg.startswith("Value error, "):
        first_error_msg = first_error_msg[13:]

    logger.warning(
        f"Validation failure on {request.method} {request.url.path}: {first_error_msg}"
    )

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "success": False,
            "error": {
                "code": ERROR_CODES["VALIDATION_ERROR"],
                "message": first_error_msg,
            },
        },
    )


@app.exception_handler(AppBaseError)
async def app_exception_handler(
    request: Request,
    exc: AppBaseError,
) -> JSONResponse:
    """Handles application-specific exceptions."""
    logger.error(f"Application error: {exc.error_code} — {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.error_code,
                "message": exc.message,
            },
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Catches unhandled exceptions."""
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path}: {exc}",
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": ERROR_CODES["INTERNAL_ERROR"],
                "message": "An unexpected error occurred. Please try again later.",
            },
        },
    )


# ==========================================
# Route Registration
# ==========================================

app.include_router(health_router)
app.include_router(api_router)


@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {
        "message": f"Welcome to {SERVICE_NAME} v{SERVICE_VERSION}",
        "documentation": "/docs",
    }
