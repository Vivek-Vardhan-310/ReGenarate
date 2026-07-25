"""
Custom Exception Module.

Defines application-specific exception classes used throughout the
backend. Centralized exception handling prevents scattered try-catch
blocks and ensures consistent error responses.

Per Architecture (docs/02-Architecture.md, Section 24):
- ValidationError: Invalid request data.
- ConfigurationError: Missing or invalid environment configuration.
- AIProviderError: Groq or other provider returned an error.
- TimeoutError: AI request exceeded configured timeout.
- ParsingError: AI response could not be parsed.
- InternalServerError: Unexpected application failure.

Usage:
    from app.utils.exceptions import AIProviderError
    raise AIProviderError("Groq API returned an unexpected status.")
"""

from app.config.constants import ERROR_CODES


class AppBaseError(Exception):
    """
    Base exception for all application-specific errors.

    Attributes:
        message: Human-readable error description.
        error_code: Machine-readable error code from constants.
        status_code: HTTP status code to return.
    """

    def __init__(
        self,
        message: str = "An unexpected error occurred.",
        error_code: str = ERROR_CODES["INTERNAL_ERROR"],
        status_code: int = 500,
    ) -> None:
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        super().__init__(self.message)


class ValidationError(AppBaseError):
    """
    Raised when request data fails validation.

    Examples:
        - Missing required fields.
        - Unsupported programming language.
        - Empty source code.
        - Code exceeds size limits.
    """

    def __init__(
        self,
        message: str = "Request validation failed.",
        error_code: str = ERROR_CODES["VALIDATION_ERROR"],
        status_code: int = 422,
    ) -> None:
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status_code,
        )


class ConfigurationError(AppBaseError):
    """
    Raised when required application configuration is missing or invalid.

    Examples:
        - Missing GROQ_API_KEY.
        - Invalid MODEL_NAME.
    """

    def __init__(
        self,
        message: str = "Application configuration error.",
        error_code: str = ERROR_CODES["CONFIGURATION_ERROR"],
        status_code: int = 500,
    ) -> None:
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status_code,
        )


class AIProviderError(AppBaseError):
    """
    Raised when the AI provider (Groq) returns an error or is unavailable.

    Examples:
        - API key invalid.
        - Rate limit exceeded.
        - Model unavailable.
        - Network failure.
    """

    def __init__(
        self,
        message: str = "AI provider error. Please try again later.",
        error_code: str = ERROR_CODES["AI_PROVIDER_ERROR"],
        status_code: int = 502,
    ) -> None:
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status_code,
        )


class AITimeoutError(AppBaseError):
    """
    Raised when an AI request exceeds the configured timeout.

    The timeout value is defined in settings.REQUEST_TIMEOUT.
    """

    def __init__(
        self,
        message: str = "AI request timed out. Please try again.",
        error_code: str = ERROR_CODES["TIMEOUT_ERROR"],
        status_code: int = 408,
    ) -> None:
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status_code,
        )


class ParsingError(AppBaseError):
    """
    Raised when the AI response cannot be parsed into the expected structure.

    Examples:
        - Malformed markdown.
        - Missing expected sections.
        - Unexpected response format.
    """

    def __init__(
        self,
        message: str = "Failed to parse AI response.",
        error_code: str = ERROR_CODES["PARSING_ERROR"],
        status_code: int = 500,
    ) -> None:
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=status_code,
        )
