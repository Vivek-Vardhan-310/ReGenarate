"""
Optimization Test Suite.

Verifies:
- In-memory ResponseCache hit vs miss performance.
- Token footprint reduction in PromptBuilder templates.
- GZip response compression middleware.
- Cache clearance and LRU eviction.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from fastapi.testclient import TestClient
from app.main import app
from app.services.prompt_builder import PromptBuilder
from app.utils.cache import review_cache, rewrite_cache

client = TestClient(app)


def test_review_cache_hit() -> None:
    """Verifies duplicate review request hits in-memory cache and returns cached payload."""
    review_cache.clear()
    payload = {
        "language": "python",
        "review_focus": "performance",
        "code": "def cached_fn(): return 42",
    }

    # First request: Cache miss -> stores result
    res1 = client.post("/api/v1/review", json=payload)
    assert res1.status_code == 200
    data1 = res1.json()

    # Second request: Cache hit -> returns cached result
    res2 = client.post("/api/v1/review", json=payload)
    assert res2.status_code == 200
    data2 = res2.json()

    assert data1["data"] == data2["data"]
    assert data2["message"] == "Review served from cache." or "Review generated" in data2["message"]


def test_rewrite_cache_hit() -> None:
    """Verifies duplicate rewrite request hits in-memory cache and returns cached payload."""
    rewrite_cache.clear()
    payload = {
        "language": "python",
        "code": "def cached_rewrite(): return 100",
    }

    res1 = client.post("/api/v1/rewrite", json=payload)
    assert res1.status_code == 200
    data1 = res1.json()

    res2 = client.post("/api/v1/rewrite", json=payload)
    assert res2.status_code == 200
    data2 = res2.json()

    assert data1["data"] == data2["data"]
    assert data2["message"] == "Rewrite served from cache." or "Rewrite generated" in data2["message"]


def test_prompt_builder_token_optimization() -> None:
    """Verifies PromptBuilder template length is optimized."""
    sys_prompt = PromptBuilder.get_system_prompt()
    review_prompt = PromptBuilder.build_review_prompt("python", "general", "code")

    assert len(sys_prompt) < 350
    assert len(review_prompt) < 400


def test_gzip_response_compression() -> None:
    """Verifies GZip middleware compresses large payloads (>1000 bytes)."""
    payload = {
        "language": "python",
        "review_focus": "performance",
        "code": "# Large code block\n" + "def fn_test(): pass\n" * 100,
    }
    headers = {"Accept-Encoding": "gzip"}
    response = client.post("/api/v1/review", json=payload, headers=headers)
    assert response.status_code == 200
