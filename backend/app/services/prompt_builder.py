"""
Prompt Builder Service Module.

Constructs structured prompts for Large Language Models.
Per Prompt Engineering Specification (docs/08-Prompt-Engineering.md) & Phase 7 Optimization:
- Token-optimized prompts: concise instructions, dense context, zero fluff.
- Centralizes System Prompt, Review Prompt, and Rewrite Prompt templates.
- Performs variable substitution ({{language}}, {{review_focus}}, {{code}}).
- Ensures deterministic prompt construction.
"""

from app.config.settings import settings


class PromptBuilder:
    """
    Constructs token-optimized system and user prompts for AI operations.
    """

    SYSTEM_PROMPT = (
        "You are a senior software engineer specializing in software architecture, "
        "code quality, performance, security, and best practices.\n"
        "Review and rewrite source code while preserving intended functionality.\n"
        "Adhere to output formats strictly. Do not fabricate requirements or add fluff."
    )

    REVIEW_PROMPT_TEMPLATE = (
        "Task: Review {{language}} source code.\n"
        "Focus: {{review_focus}}\n\n"
        "Evaluate: Correctness, Readability, Maintainability, Performance, Security, Best practices, Bugs.\n"
        "Provide actionable recommendations without rewriting the full file.\n\n"
        "Output Format (Markdown only):\n"
        "# Summary\n\n# Strengths\n\n# Issues\n\n# Recommendations\n\n# Example Improvements\n\n"
        "Code:\n```{{language}}\n{{code}}\n```"
    )

    REWRITE_PROMPT_TEMPLATE = (
        "Task: Rewrite {{language}} source code.\n\n"
        "Rules:\n"
        "- Preserve behavior and business logic.\n"
        "- Improve readability, structure, and variable naming.\n"
        "- Apply {{language}} best practices.\n\n"
        "Output Format:\n"
        "- Return ONLY rewritten source code.\n"
        "- Do NOT include Markdown fences, commentary, or extra explanations.\n\n"
        "Code:\n```{{language}}\n{{code}}\n```"
    )

    @classmethod
    def get_system_prompt(cls) -> str:
        """Returns the centralized system prompt."""
        return cls.SYSTEM_PROMPT

    @classmethod
    def build_review_prompt(cls, language: str, review_focus: str, code: str) -> str:
        """Constructs token-optimized user prompt for code review."""
        prompt = cls.REVIEW_PROMPT_TEMPLATE.replace("{{language}}", language)
        prompt = prompt.replace("{{review_focus}}", review_focus)
        prompt = prompt.replace("{{code}}", code)
        return prompt

    @classmethod
    def build_rewrite_prompt(cls, language: str, code: str) -> str:
        """Constructs token-optimized user prompt for code rewrite."""
        prompt = cls.REWRITE_PROMPT_TEMPLATE.replace("{{language}}", language)
        prompt = prompt.replace("{{code}}", code)
        return prompt
