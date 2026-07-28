"""
Prompt Builder Service Module.

Constructs structured prompts for Large Language Models.
Per Prompt Engineering Specification (docs/08-Prompt-Engineering.md) & Phase 7 Optimization:
- Token-optimized prompts: concise instructions, dense context, zero fluff.
- Centralizes System Prompt, Review Prompt, and Rewrite Prompt templates.
- Performs variable substitution ({{language}}, {{review_focus}}, {{code}}).
- Ensures deterministic prompt construction.
"""

from typing import Optional
from app.config.settings import settings
from app.schemas.requests import ExecutionData


class PromptBuilder:
    """
    Constructs token-optimized system and user prompts for AI operations.
    Supports Version 2 Runtime-Aware Reviews per docs/08-Prompt-Engineering.md.
    """

    SYSTEM_PROMPT = (
        "You are a senior software engineer specializing in software architecture, "
        "code quality, performance, security, and best practices.\n"
        "Review and rewrite source code while preserving intended functionality.\n"
        "Adhere to output formats strictly. Do not fabricate requirements or add fluff."
    )

    REVIEW_PROMPT_TEMPLATE = (
        "Task: Review the following {{language}} source code and execution context.\n\n"
        "Programming Language:\n{{language}}\n\n"
        "Execution Status:\n{{execution_status}}\n\n"
        "Exit Code:\n{{exit_code}}\n\n"
        "Standard Output:\n{{stdout}}\n\n"
        "Standard Error:\n{{stderr}}\n\n"
        "Review Focus:\n{{review_focus}}\n\n"
        "Instructions:\n"
        "- Use runtime execution information whenever available during code review.\n"
        "- Runtime evidence takes precedence over static assumptions.\n"
        "- Distinguish between compile-time errors and runtime errors.\n"
        "- Correlate stack traces in standard error with source code locations and functions.\n"
        "- If execution data is unavailable (e.g. status is not_executed or execution results are absent), perform normal static analysis.\n\n"
        "Evaluate: Correctness, Readability, Maintainability, Performance, Security, Best practices, Bugs.\n\n"
        "Output Format (Markdown only):\n"
        "# Summary\n\n# Strengths\n\n# Issues\n\n# Recommendations\n\n# Example Improvements\n\n"
        "Source Code:\n```{{language}}\n{{code}}\n```"
    )

    DEBUG_REVIEW_PROMPT_TEMPLATE = (
        "Task: Provide execution-aware debugging assistance for the following {{language}} code failure.\n\n"
        "Programming Language:\n{{language}}\n\n"
        "Execution Status:\n{{execution_status}}\n\n"
        "Exit Code:\n{{exit_code}}\n\n"
        "Standard Output:\n{{stdout}}\n\n"
        "Standard Error:\n{{stderr}}\n\n"
        "Review Focus:\n{{review_focus}}\n\n"
        "Instructions:\n"
        "- Analyze the runtime error and stack trace.\n"
        "- Explain the runtime error clearly in beginner-friendly language.\n"
        "- Pinpoint the probable cause and source code location (line number/function).\n"
        "- State your debugging confidence level (High / Medium / Low).\n"
        "- Provide step-by-step suggested fixes and a corrected code snippet.\n\n"
        "Output Format (Markdown only):\n"
        "# Summary\n\n"
        "# Detected Runtime Issues\n\n"
        "# Probable Cause\n\n"
        "# Suggested Fix\n\n"
        "# Improved Code\n\n"
        "# Additional Recommendations\n\n"
        "Source Code:\n```{{language}}\n{{code}}\n```"
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
    def build_review_prompt(
        cls,
        language: str,
        review_focus: str,
        code: str,
        execution: Optional[ExecutionData] = None,
    ) -> str:
        """Constructs token-optimized user prompt for runtime-aware code review and debugging."""
        # Determine if execution failed to select execution-aware debugging template (Phase 13)
        is_runtime_failure = False
        if execution:
            if (
                execution.status == "failed"
                or (execution.exit_code is not None and execution.exit_code != 0)
                or (execution.stderr and execution.stderr.strip())
            ):
                is_runtime_failure = True

        template = cls.DEBUG_REVIEW_PROMPT_TEMPLATE if is_runtime_failure else cls.REVIEW_PROMPT_TEMPLATE

        prompt = template.replace("{{language}}", language)
        prompt = prompt.replace("{{review_focus}}", review_focus)
        prompt = prompt.replace("{{code}}", code)

        if execution:
            prompt = prompt.replace("{{execution_status}}", execution.status or "not_executed")
            prompt = prompt.replace("{{exit_code}}", str(execution.exit_code if execution.exit_code is not None else 0))
            prompt = prompt.replace("{{stdout}}", execution.stdout if execution.stdout else "(None)")
            prompt = prompt.replace("{{stderr}}", execution.stderr if execution.stderr else "(None)")
        else:
            prompt = prompt.replace("{{execution_status}}", "not_executed")
            prompt = prompt.replace("{{exit_code}}", "0")
            prompt = prompt.replace("{{stdout}}", "(None - Static Analysis)")
            prompt = prompt.replace("{{stderr}}", "(None - Static Analysis)")

        return prompt

    @classmethod
    def build_rewrite_prompt(cls, language: str, code: str) -> str:
        """Constructs token-optimized user prompt for code rewrite."""
        prompt = cls.REWRITE_PROMPT_TEMPLATE.replace("{{language}}", language)
        prompt = prompt.replace("{{code}}", code)
        return prompt
