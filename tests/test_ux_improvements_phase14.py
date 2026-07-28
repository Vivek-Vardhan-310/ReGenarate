"""
Unit Tests for Phase 14 User Experience Improvements.

Verifies:
1. System API Health status endpoint.
2. Review & Rewrite API payloads supporting UX features.
3. Full Version 2 workflow compatibility.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_endpoint():
    """Verify GET /api/v1/health returns healthy operational status."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["status"] == "healthy"


def test_review_endpoint_ux_payload():
    """Verify POST /api/v1/review accepts valid payloads with language and focus."""
    payload = {
        "language": "python",
        "review_focus": "performance",
        "code": "def process_list(lst):\n    return [x * 2 for x in lst]",
    }
    response = client.post("/api/v1/review", json=payload)
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert "review" in json_data["data"]


def test_rewrite_endpoint_ux_payload():
    """Verify POST /api/v1/rewrite accepts valid source code payloads."""
    payload = {
        "language": "javascript",
        "code": "function add(a, b) { return a + b; }",
    }
    response = client.post("/api/v1/rewrite", json=payload)
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert "rewritten_code" in json_data["data"]
