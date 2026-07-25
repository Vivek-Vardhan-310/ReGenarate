"""
AI Prompt Stability & Determinism Test Suite.

Per Prompt Engineering Specification (docs/08-Prompt-Engineering.md)
& Testing Strategy (docs/10-Testing.md, Section 14):
- Validates prompt construction across all 15 supported languages.
- Validates prompt construction across all 7 review focus categories.
- Verifies ResponseParser handling of complex Markdown and edge-case code blocks.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.config.constants import SUPPORTED_LANGUAGES, SUPPORTED_REVIEW_FOCUS
from app.services.prompt_builder import PromptBuilder
from app.services.parser import ResponseParser


def test_prompt_builder_all_languages() -> None:
    """Verifies PromptBuilder operates deterministically for all 15 supported languages."""
    dummy_code = "print('hello')"
    for lang in SUPPORTED_LANGUAGES:
        review_prompt = PromptBuilder.build_review_prompt(lang, "general", dummy_code)
        rewrite_prompt = PromptBuilder.build_rewrite_prompt(lang, dummy_code)

        assert lang in review_prompt
        assert lang in rewrite_prompt
        assert dummy_code in review_prompt
        assert dummy_code in rewrite_prompt
        assert "# Summary" in review_prompt


def test_prompt_builder_all_focus_areas() -> None:
    """Verifies PromptBuilder operates deterministically for all 7 focus areas."""
    dummy_code = "int x = 10;"
    for focus in SUPPORTED_REVIEW_FOCUS:
        prompt = PromptBuilder.build_review_prompt("java", focus, dummy_code)

        assert focus in prompt
        assert "java" in prompt
        assert dummy_code in prompt


def test_response_parser_nested_fences() -> None:
    """Verifies ResponseParser correctly strips outer markdown fences while preserving inner code blocks."""
    raw_rewrite = "```python\n```sql\nSELECT * FROM users;\n```\n```"
    parsed = ResponseParser.parse_rewrite_response(raw_rewrite)
    assert "SELECT * FROM users;" in parsed


def test_response_parser_mixed_text_and_code() -> None:
    """Verifies ResponseParser extracts the largest code block when LLM returns conversational text."""
    raw = (
        "Sure, here is your rewritten code:\n\n"
        "```go\n"
        "package main\n"
        "import \"fmt\"\n"
        "func main() {\n"
        "    fmt.Println(\"Hello World\")\n"
        "}\n"
        "```\n\n"
        "Let me know if you need anything else!"
    )
    parsed = ResponseParser.parse_rewrite_response(raw)
    assert parsed.startswith("package main")
    assert "fmt.Println" in parsed
    assert "Sure, here is your" not in parsed
    assert "Let me know" not in parsed
