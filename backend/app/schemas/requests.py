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


class ReviewRequest(BaseModel):
    """
    Request model for POST /api/v1/review.

    Attributes:
        language: Programming language of the source code.
        review_focus: Focus area for the review analysis.
        code: Source code string to be analyzed.
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
