"""
Helper Utilities Module.

Provides generic, reusable utility functions used across
the application. These helpers must remain independent of
business logic — they serve as pure utility functions.

Usage:
    from app.utils.helpers import generate_request_id
"""

import uuid
from datetime import datetime, timezone


def generate_request_id() -> str:
    """
    Generates a unique request identifier.

    Used to correlate log entries, error responses, and
    debugging across a single request lifecycle.

    Returns:
        A unique string identifier (UUID4 hex, truncated to 12 chars).
    """
    return uuid.uuid4().hex[:12]


def get_current_timestamp() -> str:
    """
    Returns the current UTC timestamp in ISO 8601 format.

    Returns:
        ISO 8601 formatted timestamp string.
    """
    return datetime.now(timezone.utc).isoformat()


def truncate_string(value: str, max_length: int = 100) -> str:
    """
    Truncates a string to the specified maximum length.

    Useful for logging where full content (e.g., source code)
    must never be written to log output.

    Args:
        value: The string to truncate.
        max_length: Maximum allowed length.

    Returns:
        Truncated string with '...' appended if it exceeded max_length.
    """
    if len(value) <= max_length:
        return value
    return value[:max_length] + "..."
