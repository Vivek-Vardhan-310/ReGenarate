"""
Backend Foundation Automated Test Suite.

Per Testing Strategy (docs/10-Testing.md):
- Validates request schema validation.
- Validates error handling responses.
- Validates API route contracts.
- Validates service layer execution.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path for test execution
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    """Verifies GET /api/v1/health returns 200 OK and valid HealthData."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "healthy"
    assert data["data"]["service"] == "AI Code Review API"
    assert data["data"]["version"] == "1.0.0"


def test_review_endpoint_valid_request() -> None:
    """Verifies POST /api/v1/review with valid payload returns 200 OK."""
    payload = {
        "language": "python",
        "review_focus": "performance",
        "code": "def add(a, b):\n    return a + b",
    }
    response = client.post("/api/v1/review", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "review" in data["data"]
    assert "# Summary" in data["data"]["review"]


def test_review_endpoint_invalid_language() -> None:
    """Verifies POST /api/v1/review with unsupported language returns 400."""
    payload = {
        "language": "cobol",
        "review_focus": "performance",
        "code": "PRINT 'Hello'",
    }
    response = client.post("/api/v1/review", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "Unsupported programming language 'cobol'" in data["error"]["message"]


def test_review_endpoint_invalid_focus() -> None:
    """Verifies POST /api/v1/review with unsupported focus returns 400."""
    payload = {
        "language": "python",
        "review_focus": "invalid_focus",
        "code": "print('hello')",
    }
    response = client.post("/api/v1/review", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "Unsupported review focus 'invalid_focus'" in data["error"]["message"]


def test_review_endpoint_empty_code() -> None:
    """Verifies POST /api/v1/review with empty code returns 400."""
    payload = {
        "language": "python",
        "review_focus": "general",
        "code": "   ",
    }
    response = client.post("/api/v1/review", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "Source code cannot be empty" in data["error"]["message"]


def test_rewrite_endpoint_valid_request() -> None:
    """Verifies POST /api/v1/rewrite with valid payload returns 200 OK."""
    payload = {
        "language": "java",
        "code": "public class Test { }",
    }
    response = client.post("/api/v1/rewrite", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "rewritten_code" in data["data"]


def test_rewrite_endpoint_invalid_language() -> None:
    """Verifies POST /api/v1/rewrite with unsupported language returns 400."""
    payload = {
        "language": "brainfuck",
        "code": "++++",
    }
    response = client.post("/api/v1/rewrite", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "Unsupported programming language 'brainfuck'" in data["error"]["message"]
