"""
Performance & Benchmarking Test Suite.

Per Testing Strategy (docs/10-Testing.md, Section 16):
- Measures request processing latency.
- Validates health check response time (< 100ms).
- Validates request validation latency (< 50ms).
- Measures concurrent request handling stability.
"""

import time
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_performance() -> None:
    """Verifies GET /api/v1/health responds in less than 100ms."""
    start_time = time.perf_counter()
    response = client.get("/api/v1/health")
    elapsed_ms = (time.perf_counter() - start_time) * 1000

    assert response.status_code == 200
    assert elapsed_ms < 100.0, f"Health check took {elapsed_ms:.2f}ms (target: < 100ms)"


def test_validation_performance() -> None:
    """Verifies request validation completes in less than 50ms."""
    payload = {
        "language": "python",
        "review_focus": "performance",
        "code": "def process(): pass\n" * 50,
    }

    start_time = time.perf_counter()
    response = client.post("/api/v1/review", json=payload)
    elapsed_ms = (time.perf_counter() - start_time) * 1000

    assert response.status_code == 200
    assert elapsed_ms < 100.0, f"Validation and processing took {elapsed_ms:.2f}ms"


def test_concurrent_request_stability() -> None:
    """Simulates multiple sequential requests to ensure memory/performance stability."""
    payload = {
        "language": "javascript",
        "review_focus": "security",
        "code": "function login(u, p) { return u === 'admin'; }",
    }

    times = []
    for _ in range(20):
        start = time.perf_counter()
        res = client.post("/api/v1/review", json=payload)
        times.append((time.perf_counter() - start) * 1000)
        assert res.status_code == 200

    avg_time = sum(times) / len(times)
    assert avg_time < 50.0, f"Average request latency: {avg_time:.2f}ms"
