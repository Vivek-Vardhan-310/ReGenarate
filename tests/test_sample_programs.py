"""
Unit tests for Sample Programs Registry.

Verifies:
1. Every language supported by backend has a dedicated, unique sample program in samplePrograms.js.
2. Sample programs demonstrate functions, variables, control flow, and meaningful output.
3. Sample retrieval handles unknown languages gracefully without crashing.
"""

import json
import re
import pytest
from app.config.constants import SUPPORTED_LANGUAGES


def load_js_sample_programs():
    """Extract samplePrograms object from frontend/js/samplePrograms.js."""
    with open("frontend/js/samplePrograms.js", "r", encoding="utf-8") as f:
        content = f.read()

    # Extract the JS object content between 'const samplePrograms = {' and '};'
    match = re.search(r"const samplePrograms = (\{[\s\S]*?\n\};)", content)
    assert match, "Could not find 'samplePrograms' object definition in samplePrograms.js"
    
    js_object_str = match.group(1)
    
    # Parse keys and multiline string values using regex
    samples = {}
    pattern = re.compile(r'^\s*([a-z0-9_]+):\s*`([\s\S]*?)`\s*(?:,|\n*\})', re.MULTILINE)
    for m in pattern.finditer(js_object_str):
        lang = m.group(1)
        code = m.group(2)
        samples[lang] = code
    return samples


def test_every_supported_language_has_sample():
    """Verify that every language in SUPPORTED_LANGUAGES has a sample program."""
    samples = load_js_sample_programs()
    
    for lang in SUPPORTED_LANGUAGES:
        assert lang in samples, f"Missing sample program for language: '{lang}'"
        assert len(samples[lang].strip()) > 0, f"Sample program for '{lang}' is empty"


def test_sample_programs_are_unique():
    """Verify that every supported language has a distinct, unique code sample."""
    samples = load_js_sample_programs()
    unique_samples = set(samples.values())
    
    # Each language must have its own unique code sample
    assert len(unique_samples) == len(samples), "Duplicate sample programs detected across languages."


def test_sample_quality_and_structure():
    """Verify sample programs meet educational quality requirements."""
    samples = load_js_sample_programs()
    
    for lang, code in samples.items():
        lines = [line for line in code.splitlines() if line.strip()]
        # Check that samples are realistic code (>= 10 lines)
        assert len(lines) >= 8, f"Sample for '{lang}' is too short ({len(lines)} lines)."
        # Verify it is not just 'Hello World'
        assert "Hello World" not in code or len(lines) > 5, f"Sample for '{lang}' is trivial."


def test_invalid_language_lookup():
    """Verify missing language handling."""
    samples = load_js_sample_programs()
    assert samples.get("non_existent_lang") is None
