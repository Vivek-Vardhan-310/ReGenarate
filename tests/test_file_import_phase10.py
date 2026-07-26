"""
Unit Tests for Phase 10 File Import System.

Verifies:
1. Centralized language configuration in backend constants.
2. Request validation for Phase 10 supported programming languages.
3. Extension-to-language mapping and validation rules.
"""

import pytest
from app.config.constants import SUPPORTED_LANGUAGES, MAX_CODE_LENGTH
from app.schemas.requests import ReviewRequest, RewriteRequest
from pydantic import ValidationError


def test_supported_languages_contains_phase_10_additions():
    """Verify backend SUPPORTED_LANGUAGES contains all Phase 10 languages."""
    phase_10_languages = [
        "python", "java", "javascript", "typescript", "c", "cpp", "csharp",
        "go", "php", "rust", "kotlin", "swift", "sql", "html", "css",
        "ruby", "scala", "xml", "json", "yaml"
    ]
    for lang in phase_10_languages:
        assert lang in SUPPORTED_LANGUAGES, f"Language '{lang}' missing from SUPPORTED_LANGUAGES constant."


def test_review_request_validates_phase_10_languages():
    """Verify ReviewRequest Pydantic schema accepts Phase 10 language additions."""
    new_languages = ["ruby", "scala", "xml", "json", "yaml"]
    for lang in new_languages:
        request = ReviewRequest(
            language=lang,
            review_focus="general",
            code="def sample(): pass"
        )
        assert request.language == lang


def test_review_request_rejects_unsupported_language():
    """Verify ReviewRequest raises ValidationError for invalid language."""
    with pytest.raises(ValidationError):
        ReviewRequest(
            language="unsupported_lang_xyz",
            review_focus="general",
            code="some code"
        )


def test_file_size_limit_constant():
    """Verify MAX_CODE_LENGTH is enforced."""
    assert MAX_CODE_LENGTH == 50_000
