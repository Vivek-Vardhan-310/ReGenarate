"""
Input Validation Module.

Provides reusable validation functions for request data.
These validators are used by both Pydantic schemas and
business services to enforce application rules.

Per Architecture (docs/02-Architecture.md, Section 21):
- Check required fields.
- Validate language selection.
- Verify code length.
- Reject empty submissions.
- Sanitize input.

Usage:
    from app.utils.validators import validate_language, validate_code
"""

from app.config.constants import (
    MAX_CODE_LENGTH,
    MIN_CODE_LENGTH,
    SUPPORTED_LANGUAGES,
    SUPPORTED_REVIEW_FOCUS,
)


def validate_language(language: str) -> bool:
    """
    Validates that the provided language is supported.

    Args:
        language: Programming language identifier (case-insensitive).

    Returns:
        True if the language is supported, False otherwise.
    """
    return language.lower().strip() in SUPPORTED_LANGUAGES


def validate_review_focus(focus: str) -> bool:
    """
    Validates that the provided review focus area is supported.

    Args:
        focus: Review focus area identifier (case-insensitive).

    Returns:
        True if the focus area is supported, False otherwise.
    """
    return focus.lower().strip() in SUPPORTED_REVIEW_FOCUS


def validate_code(code: str) -> tuple[bool, str]:
    """
    Validates submitted source code against application rules.

    Checks:
        - Code is not empty or whitespace-only.
        - Code does not exceed the maximum length.

    Args:
        code: The source code string to validate.

    Returns:
        A tuple of (is_valid, error_message).
        If valid, error_message is an empty string.
    """
    if not code or not code.strip():
        return False, "Source code cannot be empty."

    stripped_code = code.strip()

    if len(stripped_code) < MIN_CODE_LENGTH:
        return False, "Source code is too short to review."

    if len(code) > MAX_CODE_LENGTH:
        return False, (
            f"Source code exceeds the maximum length of "
            f"{MAX_CODE_LENGTH:,} characters."
        )

    return True, ""


def normalize_language(language: str) -> str:
    """
    Normalizes a language identifier to lowercase, trimmed form.

    Args:
        language: Raw language string from user input.

    Returns:
        Normalized language string.
    """
    return language.lower().strip()


def normalize_review_focus(focus: str) -> str:
    """
    Normalizes a review focus identifier to lowercase, trimmed form.

    Args:
        focus: Raw review focus string from user input.

    Returns:
        Normalized review focus string.
    """
    return focus.lower().strip()
