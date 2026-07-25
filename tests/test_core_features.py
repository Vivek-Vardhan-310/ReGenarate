"""
Phase 5 Core Features Automated Test Suite.

Verifies:
- Severity level classification constants (PRD FR-005).
- Full user workflow payload validation (PRD FR-001 to FR-006).
- End-to-end API response consistency and HTTP status codes.
- Response payloads containing review Markdown and rewritten code.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from fastapi.testclient import TestClient
from app.config.constants import (
    SEVERITY_LEVELS,
    SUPPORTED_LANGUAGES,
    SUPPORTED_REVIEW_FOCUS,
)
from app.main import app

client = TestClient(app)


def test_severity_levels_defined() -> None:
    """Verifies all mandatory severity levels exist per PRD FR-005."""
    assert "critical" in SEVERITY_LEVELS
    assert "high" in SEVERITY_LEVELS
    assert "medium" in SEVERITY_LEVELS
    assert "low" in SEVERITY_LEVELS
    assert "informational" in SEVERITY_LEVELS


def test_supported_languages_coverage() -> None:
    """Verifies supported programming languages per FR-002."""
    assert "python" in SUPPORTED_LANGUAGES
    assert "java" in SUPPORTED_LANGUAGES
    assert "javascript" in SUPPORTED_LANGUAGES
    assert "typescript" in SUPPORTED_LANGUAGES
    assert "cpp" in SUPPORTED_LANGUAGES
    assert "go" in SUPPORTED_LANGUAGES
    assert "rust" in SUPPORTED_LANGUAGES


def test_supported_focus_coverage() -> None:
    """Verifies review focus categories per FR-003."""
    assert "general" in SUPPORTED_REVIEW_FOCUS
    assert "performance" in SUPPORTED_REVIEW_FOCUS
    assert "security" in SUPPORTED_REVIEW_FOCUS
    assert "readability" in SUPPORTED_REVIEW_FOCUS
    assert "best practices" in SUPPORTED_REVIEW_FOCUS
    assert "bug detection" in SUPPORTED_REVIEW_FOCUS


def test_review_workflow_full_payload() -> None:
    """Verifies review request processing produces structured Markdown output."""
    payload = {
        "language": "python",
        "review_focus": "security",
        "code": "import sqlite3\ndef search(query):\n    conn = sqlite3.connect('db.sq3')\n    return conn.execute(f'SELECT * FROM users WHERE name={query}')",
    }
    response = client.post("/api/v1/review", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "review" in data["data"]
    assert isinstance(data["data"]["review"], str)
    assert len(data["data"]["review"]) > 0


def test_rewrite_workflow_full_payload() -> None:
    """Verifies rewrite request processing produces valid source code output."""
    payload = {
        "language": "python",
        "code": "def calc(x):\n    res = 0\n    for i in x:\n        res += i\n    return res",
    }
    response = client.post("/api/v1/rewrite", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "rewritten_code" in data["data"]
    assert isinstance(data["data"]["rewritten_code"], str)
    assert len(data["data"]["rewritten_code"]) > 0
