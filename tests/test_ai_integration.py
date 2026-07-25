"""
Phase 4 AI Integration Automated Test Suite.

Verifies:
- PromptBuilder prompt templates and variable substitutions.
- ResponseParser Markdown cleaning and code fence stripping.
- GroqClient configuration checks and exception handling.
- ReviewService and RewriteService end-to-end pipelines.
- Mocked LLM completion tests.
"""

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

# Add backend directory to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.requests import ReviewRequest, RewriteRequest
from app.services.groq_client import GroqClient
from app.services.parser import ResponseParser
from app.services.prompt_builder import PromptBuilder
from app.services.review_service import ReviewService
from app.services.rewrite_service import RewriteService
from app.utils.exceptions import ParsingError

client = TestClient(app)


# ==========================================
# PromptBuilder Unit Tests
# ==========================================

def test_prompt_builder_system_prompt() -> None:
    """Verifies system prompt retrieval."""
    system_prompt = PromptBuilder.get_system_prompt()
    assert "senior software engineer" in system_prompt
    assert "software architecture" in system_prompt


def test_prompt_builder_review_prompt_substitution() -> None:
    """Verifies variable substitution in review prompts."""
    prompt = PromptBuilder.build_review_prompt(
        language="python",
        review_focus="security",
        code="def login(u, p): pass",
    )
    assert "python" in prompt
    assert "security" in prompt
    assert "def login(u, p): pass" in prompt
    assert "# Summary" in prompt
    assert "# Issues" in prompt


def test_prompt_builder_rewrite_prompt_substitution() -> None:
    """Verifies variable substitution in rewrite prompts."""
    prompt = PromptBuilder.build_rewrite_prompt(
        language="java",
        code="public class Main {}",
    )
    assert "java" in prompt
    assert "public class Main {}" in prompt
    assert "Return ONLY rewritten source code" in prompt


# ==========================================
# ResponseParser Unit Tests
# ==========================================

def test_response_parser_review() -> None:
    """Verifies review Markdown parsing and fence stripping."""
    raw = "```markdown\n# Summary\n\nLooks good.\n```"
    parsed = ResponseParser.parse_review_response(raw)
    assert parsed.startswith("# Summary")
    assert "Looks good." in parsed


def test_response_parser_review_empty_throws() -> None:
    """Verifies ParsingError is raised on empty text."""
    with pytest.raises(ParsingError):
        ResponseParser.parse_review_response("   ")


def test_response_parser_rewrite_strips_code_fence() -> None:
    """Verifies code fences ```python ... ``` are stripped from rewrite output."""
    raw = "Here is the improved code:\n```python\ndef add(a, b):\n    return a + b\n```\nHope this helps!"
    parsed = ResponseParser.parse_rewrite_response(raw)
    assert parsed == "def add(a, b):\n    return a + b"


def test_response_parser_rewrite_raw_code() -> None:
    """Verifies pure raw code without fences is returned intact."""
    raw = "def add(a, b):\n    return a + b"
    parsed = ResponseParser.parse_rewrite_response(raw)
    assert parsed == "def add(a, b):\n    return a + b"


# ==========================================
# Services Unit & Integration Tests (Mocked LLM)
# ==========================================

def test_review_service_mocked_llm() -> None:
    """Verifies ReviewService pipeline with mocked GroqClient."""
    async def _test():
        mock_groq = MagicMock(spec=GroqClient)
        mock_groq.is_configured.return_value = True
        mock_groq.generate_completion = AsyncMock(
            return_value="# Summary\n\nAI Review Output\n\n# Strengths\n\nGood types."
        )

        service = ReviewService(groq_client=mock_groq)
        req = ReviewRequest(language="python", review_focus="general", code="x = 1")
        res = await service.generate_review(req)

        assert res.success is True
        assert "AI Review Output" in res.data["review"]
        mock_groq.generate_completion.assert_called_once()

    asyncio.run(_test())


def test_rewrite_service_mocked_llm() -> None:
    """Verifies RewriteService pipeline with mocked GroqClient."""
    async def _test():
        mock_groq = MagicMock(spec=GroqClient)
        mock_groq.is_configured.return_value = True
        mock_groq.generate_completion = AsyncMock(
            return_value="```python\ndef add(a: int, b: int) -> int:\n    return a + b\n```"
        )

        service = RewriteService(groq_client=mock_groq)
        req = RewriteRequest(language="python", code="def add(a, b): return a + b")
        res = await service.generate_rewrite(req)

        assert res.success is True
        assert res.data["rewritten_code"] == "def add(a: int, b: int) -> int:\n    return a + b"
        mock_groq.generate_completion.assert_called_once()

    asyncio.run(_test())


# ==========================================
# End-to-End API Route Tests
# ==========================================

def test_api_review_endpoint_e2e() -> None:
    """Verifies POST /api/v1/review route end-to-end."""
    payload = {
        "language": "python",
        "review_focus": "performance",
        "code": "numbers = [i for i in range(100)]",
    }
    response = client.post("/api/v1/review", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "review" in data["data"]


def test_api_rewrite_endpoint_e2e() -> None:
    """Verifies POST /api/v1/rewrite route end-to-end."""
    payload = {
        "language": "python",
        "code": "numbers = [i for i in range(100)]",
    }
    response = client.post("/api/v1/rewrite", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "rewritten_code" in data["data"]
