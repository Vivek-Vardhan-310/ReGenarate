"""
Unit Tests for Phase 11 Integrated Execution Console.

Verifies:
1. ExecutionData Pydantic schema validation & defaults.
2. ReviewRequest with optional execution payload.
3. ReviewRequest without execution payload (backward compatibility).
4. Formatting and validation of execution output fields (stdout, stderr, exit_code).
"""

import pytest
from app.schemas.requests import ReviewRequest, ExecutionData
from pydantic import ValidationError


def test_execution_data_defaults():
    """Verify ExecutionData default values when fields are omitted."""
    data = ExecutionData()
    assert data.status == "not_executed"
    assert data.exit_code == 0
    assert data.stdout == ""
    assert data.stderr == ""
    assert data.execution_time_ms == 0


def test_execution_data_custom_values():
    """Verify ExecutionData handles custom stdout, stderr, and exit codes."""
    data = ExecutionData(
        status="failed",
        exit_code=1,
        stdout="Processing data...\n",
        stderr="ZeroDivisionError: division by zero",
        execution_time_ms=125,
    )
    assert data.status == "failed"
    assert data.exit_code == 1
    assert data.stdout == "Processing data...\n"
    assert data.stderr == "ZeroDivisionError: division by zero"
    assert data.execution_time_ms == 125


def test_review_request_with_execution_payload():
    """Verify ReviewRequest accepts optional execution object."""
    request = ReviewRequest(
        language="python",
        review_focus="general",
        code="print('Hello World')",
        execution=ExecutionData(
            status="success",
            exit_code=0,
            stdout="Hello World\n",
            stderr="",
            execution_time_ms=15,
        ),
    )
    assert request.execution is not None
    assert request.execution.status == "success"
    assert request.execution.stdout == "Hello World\n"
    assert request.execution.exit_code == 0


def test_review_request_without_execution_payload():
    """Verify ReviewRequest maintains backward compatibility when execution is omitted."""
    request = ReviewRequest(
        language="python",
        review_focus="general",
        code="print('Hello World')",
    )
    assert request.execution is None
