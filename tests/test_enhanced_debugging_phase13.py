"""
Unit Tests for Phase 13 Enhanced AI Debugging.

Verifies:
1. Selection of DEBUG_REVIEW_PROMPT_TEMPLATE on execution failure (failed status, exit_code != 0, stderr present).
2. Selection of standard REVIEW_PROMPT_TEMPLATE on execution success or static analysis.
3. ResponseParser compatibility with enhanced debugging section titles.
4. ReviewService generation of debugging review output.
"""

import pytest
from app.schemas.requests import ExecutionData, ReviewRequest
from app.services.prompt_builder import PromptBuilder
from app.services.review_service import ReviewService
from app.services.parser import ResponseParser


def test_prompt_builder_selects_debug_template_on_failed_status():
    """Verify PromptBuilder chooses DEBUG_REVIEW_PROMPT_TEMPLATE when execution.status == 'failed'."""
    execution = ExecutionData(
        status="failed",
        exit_code=1,
        stdout="",
        stderr="NameError: name 'x' is not defined",
        execution_time_ms=10,
    )

    prompt = PromptBuilder.build_review_prompt("python", "general", "print(x)", execution)

    assert "Provide execution-aware debugging assistance" in prompt
    assert "# Detected Runtime Issues" in prompt
    assert "# Probable Cause" in prompt
    assert "# Suggested Fix" in prompt
    assert "# Improved Code" in prompt


def test_prompt_builder_selects_debug_template_on_nonzero_exit_code():
    """Verify PromptBuilder chooses debug template when exit_code is non-zero even if status is default."""
    execution = ExecutionData(
        status="not_executed",
        exit_code=137,
        stdout="",
        stderr="Killed (out of memory)",
        execution_time_ms=500,
    )

    prompt = PromptBuilder.build_review_prompt("cpp", "performance", "int main() { ... }", execution)

    assert "Provide execution-aware debugging assistance" in prompt
    assert "Exit Code:\n137" in prompt
    assert "# Probable Cause" in prompt


def test_prompt_builder_selects_standard_template_on_success():
    """Verify PromptBuilder chooses standard REVIEW_PROMPT_TEMPLATE when execution succeeds."""
    execution = ExecutionData(
        status="success",
        exit_code=0,
        stdout="Result: 42\n",
        stderr="",
        execution_time_ms=15,
    )

    prompt = PromptBuilder.build_review_prompt("python", "general", "print(42)", execution)

    assert "Task: Review the following python source code and execution context." in prompt
    assert "# Strengths" in prompt
    assert "# Issues" in prompt


def test_parser_handles_debugging_review_sections():
    """Verify ResponseParser processes enhanced debugging markdown output."""
    raw_markdown = (
        "```markdown\n"
        "# Summary\nProgram failed due to missing dependency.\n\n"
        "# Detected Runtime Issues\nModuleNotFoundError: No module named 'requests'\n\n"
        "# Probable Cause\nPackage requests is not installed in the environment.\n\n"
        "# Suggested Fix\nRun `pip install requests`.\n\n"
        "# Improved Code\n```python\nimport requests\n```\n"
        "```"
    )

    parsed = ResponseParser.parse_review_response(raw_markdown)

    assert "# Summary" in parsed
    assert "# Detected Runtime Issues" in parsed
    assert "# Probable Cause" in parsed
    assert "# Suggested Fix" in parsed
    assert "# Improved Code" in parsed
    assert not parsed.startswith("```markdown")


@pytest.mark.anyio
async def test_review_service_generates_debugging_mock_on_failure():
    """Verify ReviewService returns structured debugging review when execution fails in demo mode."""
    service = ReviewService()
    request = ReviewRequest(
        language="python",
        review_focus="general",
        code="1 / 0",
        execution=ExecutionData(
            status="failed",
            exit_code=1,
            stdout="",
            stderr="ZeroDivisionError: division by zero",
            execution_time_ms=5,
        ),
    )

    response = await service.generate_review(request)

    assert response.success is True
    review_text = response.data["review"]
    assert "# Detected Runtime Issues" in review_text
    assert "# Probable Cause" in review_text
    assert "# Suggested Fix" in review_text
