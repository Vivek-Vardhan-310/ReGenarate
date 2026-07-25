"""
Centralized Logging Module.

Configures application-wide logging with structured output format.
All modules should use the logger provided by this module rather
than Python's print() function.

Per Engineering Standards (docs/03-Rules.md, PY-008):
- Never use print() for diagnostic output.
- Use logger.info(), logger.warning(), logger.error(), etc.

Per Architecture (docs/02-Architecture.md, Section 23):
- Sensitive data (API keys, source code) must never be logged.
- Log fields: timestamp, request ID, severity, endpoint, duration.

Usage:
    from app.utils.logger import logger
    logger.info("Review request received", extra={"request_id": "abc123"})
"""

import logging
import sys
from typing import Optional

from app.config.settings import settings


def setup_logger(name: str = "app", level: Optional[int] = None) -> logging.Logger:
    """
    Creates and configures a logger instance with structured formatting.

    Args:
        name: Logger name, typically the application or module name.
        level: Logging level override. Defaults to DEBUG in debug mode,
               INFO otherwise.

    Returns:
        Configured logging.Logger instance.
    """
    app_logger = logging.getLogger(name)

    # Prevent duplicate handler attachment on repeated calls
    if app_logger.handlers:
        return app_logger

    # Determine log level from settings
    if level is not None:
        log_level = level
    elif settings.DEBUG:
        log_level = logging.DEBUG
    else:
        log_level = logging.INFO

    app_logger.setLevel(log_level)

    # ---- Console Handler ----
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)

    # Structured log format
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console_handler.setFormatter(formatter)

    app_logger.addHandler(console_handler)

    # Prevent log propagation to root logger
    app_logger.propagate = False

    return app_logger


# Application-wide logger instance
logger = setup_logger()
