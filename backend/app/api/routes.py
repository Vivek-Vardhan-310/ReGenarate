"""
Application API Routes.

Defines the core review and rewrite endpoints.

Per Architecture (docs/02-Architecture.md, Section 9 & 27):
- Receives requests and validates JSON via Pydantic schemas.
- Calls business services (`ReviewService`, `RewriteService`).
- Returns standardized `SuccessResponse` or `ErrorResponse`.
- Does NOT contain AI prompts or business logic directly.
"""

from fastapi import APIRouter, Depends, status

from app.config.constants import API_PREFIX
from app.schemas.requests import ReviewRequest, RewriteRequest, QuickFixRequest, RunCodeRequest
from app.schemas.responses import SuccessResponse, RunCodeData
from app.services.review_service import ReviewService
from app.services.rewrite_service import RewriteService
from app.services.quick_fix_service import QuickFixService
from app.services.jdoodle import JDoodleService

router = APIRouter(prefix=API_PREFIX, tags=["AI & Code Execution Operations"])


# Dependency injection providers for services
def get_review_service() -> ReviewService:
    """Dependency provider for ReviewService instance."""
    return ReviewService()


def get_rewrite_service() -> RewriteService:
    """Dependency provider for RewriteService instance."""
    return RewriteService()


def get_quick_fix_service() -> QuickFixService:
    """Dependency provider for QuickFixService instance."""
    return QuickFixService()


def get_jdoodle_service() -> JDoodleService:
    """Dependency provider for JDoodleService instance."""
    return JDoodleService()


@router.post(
    "/review",
    response_model=SuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate AI Code Review",
    description="Analyzes submitted source code and returns an AI-generated review.",
)
async def review_code(
    request: ReviewRequest,
    service: ReviewService = Depends(get_review_service),
) -> SuccessResponse:
    """
    Endpoint to trigger code review analysis.

    Args:
        request: Validated ReviewRequest payload.
        service: Injected ReviewService instance.

    Returns:
        SuccessResponse containing the review Markdown data.
    """
    return await service.generate_review(request)


@router.post(
    "/rewrite",
    response_model=SuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate AI Code Rewrite",
    description="Generates an improved implementation of submitted source code.",
)
async def rewrite_code(
    request: RewriteRequest,
    service: RewriteService = Depends(get_rewrite_service),
) -> SuccessResponse:
    """
    Endpoint to trigger code rewrite generation.

    Args:
        request: Validated RewriteRequest payload.
        service: Injected RewriteService instance.

    Returns:
        SuccessResponse containing the rewritten source code.
    """
    return await service.generate_rewrite(request)


@router.post(
    "/quick-fix",
    response_model=SuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate AI Quick Fix",
    description="Generates a targeted fix for a specific code review issue.",
)
async def quick_fix_code(
    request: QuickFixRequest,
    service: QuickFixService = Depends(get_quick_fix_service),
) -> SuccessResponse:
    """
    Endpoint to trigger a targeted AI quick fix.

    Args:
        request: Validated QuickFixRequest payload.
        service: Injected QuickFixService instance.

    Returns:
        SuccessResponse containing the structured QuickFixData.
    """
    return await service.generate_quick_fix(request)


@router.post(
    "/run",
    response_model=SuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute Code via JDoodle",
    description="Executes source code using the JDoodle Compiler API and returns output and metrics.",
)
async def run_code(
    request: RunCodeRequest,
    service: JDoodleService = Depends(get_jdoodle_service),
) -> SuccessResponse:
    """
    Endpoint to execute source code via JDoodle API.

    Args:
        request: Validated RunCodeRequest payload.
        service: Injected JDoodleService instance.

    Returns:
        SuccessResponse containing RunCodeData payload.
    """
    result = await service.execute_code(
        code=request.code,
        language=request.language,
        stdin=request.stdin or "",
    )
    is_success = result.get("execution_success", True)
    msg = "Code executed successfully." if is_success else "Code execution completed with errors."
    return SuccessResponse(
        success=True,
        data=result,
        message=msg,
    )


@router.post(
    "/execute",
    response_model=SuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute Code via JDoodle (Alias)",
    description="Alias endpoint for /run to execute source code via JDoodle Compiler API.",
    include_in_schema=False,
)
async def execute_code(
    request: RunCodeRequest,
    service: JDoodleService = Depends(get_jdoodle_service),
) -> SuccessResponse:
    """
    Alias endpoint for POST /run.
    """
    return await run_code(request, service)

