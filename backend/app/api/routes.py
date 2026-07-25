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
from app.schemas.requests import ReviewRequest, RewriteRequest
from app.schemas.responses import SuccessResponse
from app.services.review_service import ReviewService
from app.services.rewrite_service import RewriteService

router = APIRouter(prefix=API_PREFIX, tags=["AI Operations"])


# Dependency injection providers for services
def get_review_service() -> ReviewService:
    """Dependency provider for ReviewService instance."""
    return ReviewService()


def get_rewrite_service() -> RewriteService:
    """Dependency provider for RewriteService instance."""
    return RewriteService()


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
