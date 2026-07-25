"""
Health Check Endpoint.

Provides a lightweight health check route used by monitoring
systems, load balancers, and frontend startup checks.

Per API spec (docs/07-API.md, Section 12):
- GET /api/v1/health
- Returns quickly.
- Avoids expensive operations.
- Does not contact the AI provider.
"""

from fastapi import APIRouter

from app.config.constants import API_PREFIX, SERVICE_NAME, SERVICE_VERSION
from app.schemas.responses import HealthData, SuccessResponse

router = APIRouter(prefix=API_PREFIX, tags=["Health"])


@router.get(
    "/health",
    response_model=SuccessResponse,
    summary="Service Health Check",
    description="Returns the operational status of the backend service.",
)
async def health_check() -> SuccessResponse:
    """
    Returns the current health status of the application.

    This endpoint performs no expensive operations and should
    respond within milliseconds.

    Returns:
        SuccessResponse containing service health data.
    """
    health_data = HealthData(
        status="healthy",
        service=SERVICE_NAME,
        version=SERVICE_VERSION,
    )

    return SuccessResponse(
        success=True,
        data=health_data.model_dump(),
        message="Service is operational.",
    )
