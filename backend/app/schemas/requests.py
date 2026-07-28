"""
Request Schema Module.

Defines Pydantic models for incoming API request payloads.
Every request model includes type annotations, field descriptions,
and custom field validators to enforce application business rules
before any service layer execution.

Per API Spec (docs/07-API.md, Sections 13 and 14):
- ReviewRequest: language, review_focus, code
- RewriteRequest: language, code
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator

from app.config.constants import (
    MAX_CODE_LENGTH,
    MIN_CODE_LENGTH,
    SUPPORTED_LANGUAGES,
    SUPPORTED_REVIEW_FOCUS,
)
from app.utils.validators import (
    normalize_language,
    normalize_review_focus,
)


class ExecutionData(BaseModel):
    """
    Optional runtime execution output model per Phase 11 & Phase 12 (docs/07-API.md, Section 13).

    Attributes:
        status: Execution status ('success', 'failed', 'not_executed').
        exit_code: Exit code returned by runtime (0 = success).
        stdout: Standard output text produced during program execution.
        stderr: Standard error / traceback text produced during program execution.
        execution_time_ms: Duration of program execution in milliseconds.
    """

    status: Optional[str] = Field(
        default="not_executed",
        description="Execution status ('success', 'failed', 'not_executed').",
        examples=["success", "failed", "not_executed"],
    )
    exit_code: Optional[int] = Field(
        default=0,
        description="Exit status integer returned by execution environment.",
        examples=[0, 1, 137],
    )
    stdout: Optional[str] = Field(
        default="",
        description="Standard output produced during execution.",
        examples=["Factorial of 5 = 120\n"],
    )
    stderr: Optional[str] = Field(
        default="",
        description="Standard error or stack trace produced during execution.",
        examples=["ZeroDivisionError: division by zero"],
    )
    execution_time_ms: Optional[int] = Field(
        default=0,
        description="Execution time in milliseconds.",
        examples=[42],
    )


class ReviewRequest(BaseModel):
    """
    Request model for POST /api/v1/review.

    Attributes:
        language: Programming language of the source code.
        review_focus: Focus area for the review analysis.
        code: Source code string to be analyzed.
        execution: Optional runtime execution data payload.
    """

    language: str = Field(
        ...,
        description="Programming language of the source code.",
        examples=["python", "java", "javascript"],
    )
    review_focus: str = Field(
        ...,
        description="Target focus area for the code review.",
        examples=["general", "performance", "security"],
    )
    code: str = Field(
        ...,
        description="Source code string to analyze.",
        examples=["def add(a, b):\n    return a + b"],
    )
    execution: Optional[ExecutionData] = Field(
        default=None,
        description="Optional runtime execution data object (Phase 11 & Phase 12).",
    )

    @field_validator("language")
    @classmethod
    def validate_language_field(cls, value: str) -> str:
        """Validates and normalizes the programming language."""
        if not value or not value.strip():
            raise ValueError("Programming language is required.")

        normalized = normalize_language(value)
        if normalized not in SUPPORTED_LANGUAGES:
            supported_list = ", ".join(SUPPORTED_LANGUAGES)
            raise ValueError(
                f"Unsupported programming language '{value}'. "
                f"Supported languages are: {supported_list}"
            )
        return normalized

    @field_validator("review_focus")
    @classmethod
    def validate_review_focus_field(cls, value: str) -> str:
        """Validates and normalizes the review focus area."""
        if not value or not value.strip():
            raise ValueError("Review focus area is required.")

        normalized = normalize_review_focus(value)
        if normalized not in SUPPORTED_REVIEW_FOCUS:
            supported_list = ", ".join(SUPPORTED_REVIEW_FOCUS)
            raise ValueError(
                f"Unsupported review focus '{value}'. "
                f"Supported focus areas are: {supported_list}"
            )
        return normalized

    @field_validator("code")
    @classmethod
    def validate_code_field(cls, value: str) -> str:
        """Validates the source code content and length."""
        if not value or not value.strip():
            raise ValueError("Source code cannot be empty.")

        stripped = value.strip()
        if len(stripped) < MIN_CODE_LENGTH:
            raise ValueError("Source code is too short to review.")

        if len(value) > MAX_CODE_LENGTH:
            raise ValueError(
                f"Source code exceeds the maximum allowed length of "
                f"{MAX_CODE_LENGTH:,} characters."
            )
        return value


class RewriteRequest(BaseModel):
    """
    Request model for POST /api/v1/rewrite.

    Attributes:
        language: Programming language of the source code.
        code: Source code string to be rewritten.
    """

    language: str = Field(
        ...,
        description="Programming language of the source code.",
        examples=["python", "java", "javascript"],
    )
    code: str = Field(
        ...,
        description="Original source code string to rewrite.",
        examples=["def add(a, b):\n    return a + b"],
    )

    @field_validator("language")
    @classmethod
    def validate_language_field(cls, value: str) -> str:
        """Validates and normalizes the programming language."""
        if not value or not value.strip():
            raise ValueError("Programming language is required.")

        normalized = normalize_language(value)
        if normalized not in SUPPORTED_LANGUAGES:
            supported_list = ", ".join(SUPPORTED_LANGUAGES)
            raise ValueError(
                f"Unsupported programming language '{value}'. "
                f"Supported languages are: {supported_list}"
            )
        return normalized

    @field_validator("code")
    @classmethod
    def validate_code_field(cls, value: str) -> str:
        """Validates the source code content and length."""
        if not value or not value.strip():
            raise ValueError("Source code cannot be empty.")

        stripped = value.strip()
        if len(stripped) < MIN_CODE_LENGTH:
            raise ValueError("Source code is too short to rewrite.")

        if len(value) > MAX_CODE_LENGTH:
            raise ValueError(
                f"Source code exceeds the maximum allowed length of "
                f"{MAX_CODE_LENGTH:,} characters."
            )
        return value
