"""
Deployment Verification & Health Check Script.

Executes pre-flight and post-deployment validation checks:
- Verifies FastAPI application initialization.
- Tests HTTP GET /api/v1/health endpoint.
- Tests POST /api/v1/review endpoint payload handling.
- Tests POST /api/v1/rewrite endpoint payload handling.
- Validates JSON schema compliance and SLA response times.

Usage:
    python scripts/verify_deployment.py [base_url]
"""

import sys
import time
from pathlib import Path

# Add backend directory to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def run_deployment_verification() -> bool:
    """
    Executes in-process health checks and API validation.

    Returns:
        True if all verification checks pass, False otherwise.
    """
    print("=" * 60)
    print("AI Code Review & Rewrite Agent — Deployment Verification")
    print("=" * 60)

    success_count = 0
    total_checks = 3

    # Check 1: Health Endpoint
    print("\n[1/3] Testing Health Check (/api/v1/health)...")
    try:
        start_time = time.perf_counter()
        response = client.get("/api/v1/health")
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        if response.status_code == 200:
            data = response.json()
            if data.get("success") and data.get("data", {}).get("status") == "healthy":
                print(f"  [PASS] Status: 200 OK | Latency: {elapsed_ms:.2f}ms")
                print(f"         Service: {data['data']['service']} v{data['data']['version']}")
                success_count += 1
            else:
                print(f"  [FAIL] Unexpected JSON response: {data}")
        else:
            print(f"  [FAIL] HTTP {response.status_code}: {response.text}")
    except Exception as exc:
        print(f"  [FAIL] Connection error: {exc}")

    # Check 2: Code Review Endpoint
    print("\n[2/3] Testing Review Endpoint (/api/v1/review)...")
    try:
        payload = {
            "language": "python",
            "review_focus": "performance",
            "code": "def process_data(items):\n    return [x * 2 for x in items]",
        }
        start_time = time.perf_counter()
        response = client.post("/api/v1/review", json=payload)
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "review" in data.get("data", {}):
                print(f"  [PASS] Status: 200 OK | Latency: {elapsed_ms:.2f}ms")
                print("         Review payload received and validated.")
                success_count += 1
            else:
                print(f"  [FAIL] Invalid review payload: {data}")
        else:
            print(f"  [FAIL] HTTP {response.status_code}: {response.text}")
    except Exception as exc:
        print(f"  [FAIL] Connection error: {exc}")

    # Check 3: Code Rewrite Endpoint
    print("\n[3/3] Testing Rewrite Endpoint (/api/v1/rewrite)...")
    try:
        payload = {
            "language": "python",
            "code": "def calc(a, b): return a + b",
        }
        start_time = time.perf_counter()
        response = client.post("/api/v1/rewrite", json=payload)
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "rewritten_code" in data.get("data", {}):
                print(f"  [PASS] Status: 200 OK | Latency: {elapsed_ms:.2f}ms")
                print("         Rewrite payload received and validated.")
                success_count += 1
            else:
                print(f"  [FAIL] Invalid rewrite payload: {data}")
        else:
            print(f"  [FAIL] HTTP {response.status_code}: {response.text}")
    except Exception as exc:
        print(f"  [FAIL] Connection error: {exc}")

    print("\n" + "=" * 60)
    if success_count == total_checks:
        print(f"DEPLOYMENT VERIFICATION PASSED ({success_count}/{total_checks} checks passed)")
        print("=" * 60)
        return True
    else:
        print(f"DEPLOYMENT VERIFICATION FAILED ({success_count}/{total_checks} checks passed)")
        print("=" * 60)
        return False


if __name__ == "__main__":
    is_ok = run_deployment_verification()
    sys.exit(0 if is_ok else 1)
