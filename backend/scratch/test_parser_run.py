"""
Unit tests for ReviewParser.
Run from f:/ReGenarate/backend/ with:
  .venv/Scripts/python.exe scratch/test_parser_run.py
"""
import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.services.review_parser import ReviewParser  # noqa: E402

PASS_SYM = "PASS"
FAIL_SYM = "FAIL"
_failures = []


def check(label: str, condition: bool, extra: str = "") -> None:
    if condition:
        msg = f"{PASS_SYM}: {label}"
        if extra:
            msg += f"  [{extra}]"
        print(msg)
    else:
        msg = f"{FAIL_SYM}: {label}"
        if extra:
            msg += f"  [{extra}]"
        print(msg)
        _failures.append(label)


# ── Test 1: Valid JSON ────────────────────────────────────────────────────────
print("=== Test 1: Valid JSON ===")
r1 = ReviewParser.parse(json.dumps({
    "summary": "Test summary",
    "issues": [{
        "id": 99,           # will be overwritten to 1
        "severity": "HIGH", # normalized → "high"
        "title": "T",
        "description": "D",
        "confidence": 1.5,  # clamped → 1.0
    }],
    "strengths": ["Good naming"],
    "recommendations": ["Fix issues"],
    "markdown": "# Test",
}))
check("T1 issues key present",           "issues" in r1)
check("T1 severity normalized to high",  r1["issues"][0]["severity"] == "high",
      r1["issues"][0]["severity"])
check("T1 confidence clamped to 1.0",    r1["issues"][0]["confidence"] == 1.0,
      str(r1["issues"][0]["confidence"]))
check("T1 id reassigned to 1",           r1["issues"][0]["id"] == 1,
      str(r1["issues"][0]["id"]))
check("T1 summary preserved",            r1["summary"] == "Test summary")
check("T1 strengths preserved",          r1["strengths"] == ["Good naming"])

# ── Test 2: JSON wrapped in triple-backtick fences ───────────────────────────
print("\n=== Test 2: Fenced JSON ===")
inner = json.dumps({"summary": "ok", "issues": [], "strengths": [], "recommendations": [], "markdown": ""})
fenced = "```json\n" + inner + "\n```"
r2 = ReviewParser.parse(fenced)
check("T2 fenced JSON parsed",           "issues" in r2)

# ── Test 3: Malformed JSON → fallback ────────────────────────────────────────
print("\n=== Test 3: Malformed JSON fallback ===")
r3 = ReviewParser.parse("This is pure prose with no JSON object whatsoever.")
check("T3 fallback has review key",      "review" in r3)
check("T3 fallback has no issues key",   "issues" not in r3)

# ── Test 4: Empty string → fallback ──────────────────────────────────────────
print("\n=== Test 4: Empty string ===")
r4 = ReviewParser.parse("")
check("T4 empty returns review key",     "review" in r4)

# ── Test 5: Severity aliases + recount ───────────────────────────────────────
print("\n=== Test 5: Severity aliases & recomputation ===")
r5 = ReviewParser.parse(json.dumps({
    "summary": "",
    "issues": [
        {"id": 1, "severity": "critical", "title": "A", "description": "B"},  # → critical
        {"id": 2, "severity": "low",      "title": "C", "description": "D"},  # → low
        {"id": 3, "severity": "fatal",    "title": "E", "description": "F"},  # alias → critical
        {"id": 4, "severity": "warning",  "title": "G", "description": "H"},  # alias → medium
        {"id": 5, "severity": "info",     "title": "I", "description": "J"},  # alias → low
    ],
    "strengths": [],
    "recommendations": [],
    "markdown": "",
}))
c = r5["severity"]
check("T5 critical=2 (fatal->critical)",  c["critical"] == 2, str(c))
check("T5 medium=1  (warning->medium)",   c["medium"]   == 1, str(c))
check("T5 low=2     (low + info)",         c["low"]      == 2, str(c))
ids = [i["id"] for i in r5["issues"]]
check("T5 sequential IDs 1..5",          ids == [1, 2, 3, 4, 5], str(ids))

# ── Test 6: null line numbers preserved ──────────────────────────────────────
print("\n=== Test 6: null line numbers ===")
r6 = ReviewParser.parse(json.dumps({
    "summary": "",
    "issues": [{
        "id": 1, "severity": "low", "title": "T", "description": "D",
        "line": None, "column": None, "endLine": None, "endColumn": None,
    }],
    "strengths": [], "recommendations": [], "markdown": "",
}))
check("T6 line is None",    r6["issues"][0]["line"]      is None)
check("T6 column is None",  r6["issues"][0]["column"]    is None)
check("T6 endLine is None", r6["issues"][0]["endLine"]   is None)

# ── Test 7: markdown generated when absent from LLM JSON ─────────────────────
print("\n=== Test 7: markdown field auto-generated ===")
r7 = ReviewParser.parse(json.dumps({
    "summary": "My summary here",
    "issues": [{
        "id": 1, "severity": "high", "title": "T", "description": "D",
        "suggestion": "Fix it",
    }],
    "strengths": ["Good naming"],
    "recommendations": ["Improve tests"],
    # No "markdown" key
}))
check("T7 markdown exists",             bool(r7.get("markdown")))
check("T7 markdown has summary",        "My summary here" in r7["markdown"])
check("T7 markdown has strength",       "Good naming" in r7["markdown"])

# ── Summary ───────────────────────────────────────────────────────────────────
print()
print("=" * 44)
if _failures:
    print(f"FAILED: {len(_failures)} test(s) failed:")
    for f in _failures:
        print(f"  {FAIL_SYM} {f}")
    sys.exit(1)
else:
    print("ALL 7 TEST CASES PASSED")
    print("=" * 44)
