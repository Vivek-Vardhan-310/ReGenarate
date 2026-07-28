"""
Response Schema Module.

Defines standardized response models used by all API endpoints.
Every response follows a consistent structure per API spec
(docs/07-API.md, Sections 8, 13, 14, 16).

Success Response:
    {
        "success": true,
        "data": { ... },
        "message": "..."
    }

Error Response:
    {
        "success": false,
        "error": {
            "code": "ERROR_CODE",
            "message": "Human-readable description."
        }
    }
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """
    Structured error information returned in error responses.

    Attributes:
        code: Machine-readable error code (e.g., 'VALIDATION_ERROR').
        message: Human-readable error description.
    """

    code: str = Field(
        ...,
        description="Machine-readable error code.",
        examples=["VALIDATION_ERROR"],
    )
    message: str = Field(
        ...,
        description="Human-readable error message.",
        examples=["Programming language is required."],
    )


class SuccessResponse(BaseModel):
    """
    Standard response model for successful API operations.

    Attributes:
        success: Always True for successful responses.
        data: Response payload — structure varies by endpoint.
        message: Human-readable success message.
    """

    success: bool = Field(
        default=True,
        description="Indicates operation success.",
    )
    data: Any = Field(
        default=None,
        description="Response data payload.",
    )
    message: str = Field(
        default="Operation completed successfully.",
        description="Human-readable success message.",
    )


class ErrorResponse(BaseModel):
    """
    Standard response model for failed API operations.

    Attributes:
        success: Always False for error responses.
        error: Structured error details.
    """

    success: bool = Field(
        default=False,
        description="Indicates operation failure.",
    )
    error: ErrorDetail = Field(
        ...,
        description="Structured error information.",
    )


class HealthData(BaseModel):
    """
    Health check response data.

    Per API spec (docs/07-API.md, Section 12).
    """

    status: str = Field(
        default="healthy",
        description="Current service health status.",
    )
    service: str = Field(
        default="AI Code Review API",
        description="Service identifier.",
    )
    version: str = Field(
        default="1.0.0",
        description="Application version.",
    )


class IssueItem(BaseModel):
    """
    A single code issue identified by the AI review.

    Mirrors the frontend Issue data model exactly so the frontend
    can consume every field without transformation.
    """

    id: int = Field(
        ...,
        description="Sequential issue identifier starting from 1.",
    )
    severity: str = Field(
        ...,
        description="Issue severity: critical | high | medium | low.",
    )
    category: Optional[str] = Field(
        default=None,
        description="Issue category (e.g. Security, Performance).",
    )
    confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="AI confidence score between 0.0 and 1.0.",
    )
    title: str = Field(
        ...,
        description="Short, descriptive issue title.",
    )
    description: str = Field(
        ...,
        description="Detailed explanation of the issue.",
    )
    line: Optional[int] = Field(
        default=None,
        description="1-based line number where the issue starts.",
    )
    column: Optional[int] = Field(
        default=None,
        description="1-based column number where the issue starts.",
    )
    endLine: Optional[int] = Field(
        default=None,
        description="1-based line number where the issue ends.",
    )
    endColumn: Optional[int] = Field(
        default=None,
        description="1-based column number where the issue ends.",
    )
    suggestion: Optional[str] = Field(
        default=None,
        description="Recommended fix or improvement.",
    )
    fixSnippet: Optional[str] = Field(
        default=None,
        description="Concrete code snippet demonstrating the fix.",
    )
    fixType: Optional[str] = Field(
        default=None,
        description="Type of fix: replace | insert | delete | refactor.",
    )


class SeverityCounts(BaseModel):
    """
    Aggregated severity counts for the severity dashboard.
    """

    critical: int = Field(default=0, description="Number of critical issues.")
    high: int     = Field(default=0, description="Number of high issues.")
    medium: int   = Field(default=0, description="Number of medium issues.")
    low: int      = Field(default=0, description="Number of low issues.")


class StructuredReviewData(BaseModel):
    """
    Structured AI review response payload.

    Contains both structured issue data (for the IDE panel) and a
    markdown field (for backward compatibility with legacy renderers).
    """

    summary: str = Field(
        default="",
        description="High-level assessment of the submitted code.",
    )
    severity: SeverityCounts = Field(
        default_factory=SeverityCounts,
        description="Aggregated issue counts per severity level.",
    )
    issues: List[IssueItem] = Field(
        default_factory=list,
        description="Detailed list of identified issues.",
    )
    strengths: List[str] = Field(
        default_factory=list,
        description="Positive aspects of the submitted code.",
    )
    recommendations: List[str] = Field(
        default_factory=list,
        description="High-level improvement recommendations.",
    )
    markdown: str = Field(
        default="",
        description="Full review as Markdown text (backward-compatibility field).",
    )


class ReviewData(BaseModel):
    """
    Review operation response data payload.

    Per API spec (docs/07-API.md, Section 13).
    """

    review: str = Field(
        ...,
        description="Markdown review text generated by the service.",
    )


class RewriteData(BaseModel):
    """
    Rewrite operation response data payload.

    Per API spec (docs/07-API.md, Section 14).
    """

    rewritten_code: str = Field(
        ...,
        description="Improved source code string generated by the service.",
    )


class ChangedLine(BaseModel):
    """
    Represents a specific line modification made by the Quick Fix.
    """

    line: int = Field(..., description="The starting line number of the change.")
    endLine: Optional[int] = Field(default=None, description="The ending line number of the change (if multi-line).")
    old: str = Field(..., description="The original code content.")
    new: str = Field(..., description="The new replaced code content.")


class QuickFixData(BaseModel):
    """
    Structured AI Quick Fix response payload.
    """

    fixedCode: str = Field(
        ...,
        description="The completely patched source code.",
    )
    explanation: str = Field(
        ...,
        description="Explanation of what changed and why.",
    )
    changedLines: List[ChangedLine] = Field(
        default_factory=list,
        description="Structured diff of the changes made.",
    )
    issueId: int = Field(
        ...,
        description="ID of the issue that was targeted.",
    )
    success: bool = Field(
        default=True,
        description="Whether the AI successfully fixed the issue.",
    )
    confidence: Optional[float] = Field(
        default=None,
        description="Model confidence score for this fix.",
    )
    model: Optional[str] = Field(
        default=None,
        description="The AI model used for the fix.",
    )
