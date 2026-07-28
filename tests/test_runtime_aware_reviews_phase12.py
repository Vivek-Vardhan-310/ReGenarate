"""
Unit Tests for Phase 12 Runtime-Aware AI Reviews.

Verifies:
1. PromptBuilder substitution of execution_status, exit_code, stdout, stderr.
2. PromptBuilder fallback to static analysis when execution data is omitted or not_executed.
3. ReviewService execution context integration.
4. Cache differentiation between static and runtime-aware reviews.
"""

import pytest

from app.schemas.requests import ExecutionData, ReviewRequest
from app.services.prompt_builder import PromptBuilder
from app.services.review_service import ReviewService
from app.utils.cache import review_cache


def test_prompt_builder_runtime_aware_variables():
    """Verify PromptBuilder correctly substitutes runtime execution variables into review prompt."""
    execution = ExecutionData(
        status="failed",
        exit_code=1,
        stdout="Calculating sum...\n",
        stderr="ZeroDivisionError: division by zero",
        execution_time_ms=50,
    )

    prompt = PromptBuilder.build_review_prompt(
        language="python",
        review_focus="general",
        code="def divide(a, b):\n    return a / b\n\ndivide(10, 0)",
        execution=execution,
    )

    assert "Execution Status:" in prompt
    assert "failed" in prompt
    assert "Exit Code:" in prompt
    assert "1" in prompt
    assert "Standard Output:" in prompt
    assert "Calculating sum..." in prompt
    assert "Standard Error:" in prompt
    assert "ZeroDivisionError: division by zero" in prompt
    assert "execution-aware debugging assistance" in prompt or "Runtime evidence" in prompt


def test_prompt_builder_static_fallback():
    """Verify PromptBuilder falls back to static analysis when execution data is None."""
    prompt = PromptBuilder.build_review_prompt(
        language="python",
        review_focus="general",
        code="print('Hello World')",
        execution=None,
    )

    assert "not_executed" in prompt
    assert "(None - Static Analysis)" in prompt


@pytest.mark.anyio
async def test_review_service_handles_runtime_execution_request():
    """Verify ReviewService processes runtime-aware review requests."""
    review_service = ReviewService()

    request = ReviewRequest(
        language="python",
        review_focus="general",
        code="def divide(a, b):\n    return a / b",
        execution=ExecutionData(
            status="failed",
            exit_code=1,
            stdout="",
            stderr="ZeroDivisionError: division by zero",
            execution_time_ms=30,
        ),
    )

    response = await review_service.generate_review(request)
    assert response.success is True
    assert "review" in response.data


def test_cache_differentiates_execution_data():
    """Verify review_cache produces unique keys for different execution payloads."""
    payload_static = {
        "language": "python",
        "focus": "general",
        "code": "print(1)",
        "execution": None,
    }
    payload_failed = {
        "language": "python",
        "focus": "general",
        "code": "print(1)",
        "execution": {"status": "failed", "exit_code": 1, "stdout": "", "stderr": "Error", "execution_time_ms": 10},
    }

    key_static = review_cache.generate_key("review", payload_static)
    key_failed = review_cache.generate_key("review", payload_failed)

    assert key_static != key_failed
