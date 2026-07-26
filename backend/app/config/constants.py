"""
Application Constants Module.

Defines application-wide constants that remain stable across
environments. These values are not configurable via .env —
they represent structural definitions of the application.

Constants must never be duplicated across the codebase.
Any module needing these values should import from here.
"""

# ==========================================
# API Configuration
# ==========================================

API_VERSION = "v1"
API_PREFIX = f"/api/{API_VERSION}"

# ==========================================
# Service Information
# ==========================================

SERVICE_NAME = "AI Code Review API"
SERVICE_VERSION = "1.0.0"

# ==========================================
# Supported Programming Languages
# ==========================================
# Per API spec Section 13 (docs/07-API.md)

SUPPORTED_LANGUAGES: list[str] = [
    "python",
    "java",
    "javascript",
    "typescript",
    "c",
    "cpp",
    "csharp",
    "go",
    "php",
    "rust",
    "kotlin",
    "swift",
    "sql",
    "html",
    "css",
    "ruby",
    "scala",
    "xml",
    "json",
    "yaml",
]

# ==========================================
# Supported Review Focus Areas
# ==========================================
# Per API spec Section 13 (docs/07-API.md)

SUPPORTED_REVIEW_FOCUS: list[str] = [
    "general",
    "performance",
    "security",
    "readability",
    "best practices",
    "bug detection",
    "optimization",
]

# ==========================================
# Severity Levels
# ==========================================
# Per PRD Section FR-005 (docs/01-PRD.md)

SEVERITY_LEVELS: list[str] = [
    "critical",
    "high",
    "medium",
    "low",
    "informational",
]

# ==========================================
# Request Limits
# ==========================================

MAX_CODE_LENGTH = 50_000  # Maximum characters in submitted code
MIN_CODE_LENGTH = 1       # Minimum characters (non-whitespace)

# ==========================================
# Error Codes
# ==========================================
# Structured error codes for consistent API responses

ERROR_CODES = {
    "VALIDATION_ERROR": "VALIDATION_ERROR",
    "INVALID_LANGUAGE": "INVALID_LANGUAGE",
    "INVALID_FOCUS": "INVALID_FOCUS",
    "EMPTY_CODE": "EMPTY_CODE",
    "CODE_TOO_LARGE": "CODE_TOO_LARGE",
    "UNSUPPORTED_LANGUAGE": "UNSUPPORTED_LANGUAGE",
    "AI_PROVIDER_ERROR": "AI_PROVIDER_ERROR",
    "TIMEOUT_ERROR": "TIMEOUT_ERROR",
    "PARSING_ERROR": "PARSING_ERROR",
    "CONFIGURATION_ERROR": "CONFIGURATION_ERROR",
    "INTERNAL_ERROR": "INTERNAL_ERROR",
    "NOT_IMPLEMENTED": "NOT_IMPLEMENTED",
}
