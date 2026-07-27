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

    # System prompt for generic operations (rewrite)
    SYSTEM_PROMPT = (
        "You are a senior software engineer specializing in software architecture, "
        "code quality, performance, security, and best practices.\n"
        "Review and rewrite source code while preserving intended functionality.\n"
        "Adhere to output formats strictly. Do not fabricate requirements or add fluff."
    )

    # System prompt specifically for structured code review (JSON output)
    REVIEW_SYSTEM_PROMPT = (
        "You are an expert code reviewer with deep knowledge of software security, "
        "performance, and best practices.\n"
        "Analyze source code and respond with a single, valid JSON object ONLY.\n"
        "Do NOT include any text outside the JSON object.\n"
        "Do NOT wrap the JSON in markdown code fences (``` or ```json).\n"
        "Do NOT add introductory sentences, explanations, or trailing commentary.\n"
        "Your entire response must be parseable by json.loads() with no preprocessing.\n\n"
        "The source code below is already line-numbered.\n"
        "Every line begins with: <line_number> | \n"
        "Use ONLY these provided line numbers.\n"
        "Never recount lines.\n"
        "Never estimate line numbers.\n"
        "Never ignore blank lines.\n"
        "Return the exact line numbers shown in the source.\n"
        "If an issue spans multiple lines, return the first numbered line and the last numbered line.\n"
        "If you cannot determine the exact location confidently, return null instead of guessing."
    )

    REVIEW_PROMPT_TEMPLATE = (
        "Review the following {{language}} source code with focus on: {{review_focus}}.\n\n"
        "Analyze for: correctness, security vulnerabilities, performance issues, "
        "readability, maintainability, and best practices violations.\n\n"
        "Respond with ONLY a valid JSON object matching this exact schema:\n"
        "{\n"
        '  "summary": "<overall assessment string>",\n'
        '  "strengths": ["<strength 1>", "<strength 2>"],\n'
        '  "recommendations": ["<recommendation 1>", "<recommendation 2>"],\n'
        '  "markdown": "<full review as markdown text>",\n'
        '  "issues": [\n'
        "    {\n"
        '      "id": 1,\n'
        '      "severity": "<critical|high|medium|low>",\n'
        '      "category": "<e.g. Security|Performance|Readability|Bug>",\n'
        '      "confidence": <float 0.0-1.0>,\n'
        '      "title": "<short issue title>",\n'
        '      "description": "<detailed explanation>",\n'
        '      "line": <1-based integer or null>,\n'
        '      "column": <1-based integer or null>,\n'
        '      "endLine": <1-based integer or null>,\n'
        '      "endColumn": <1-based integer or null>,\n'
        '      "suggestion": "<how to fix it>",\n'
        '      "fixSnippet": "<concrete replacement code or null>",\n'
        '      "fixType": "<replace|insert|delete|refactor or null>"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- severity must be exactly one of: critical, high, medium, low\n"
        "- Prefer returning ranges (line/endLine) instead of a single line.\n"
        "- Do not guess columns. If unknown: column = null, endColumn = null. Only return columns when reasonably confident.\n"
        "- confidence: your certainty this is a real issue (0.0-1.0)\n"
        "- fixSnippet: provide a concrete code snippet when possible, otherwise null\n"
        "- markdown: write a complete human-readable review in Markdown format "
        "  (will be used for backward compatibility)\n"
        "- Do NOT fabricate issues that do not exist\n"
        "- Do NOT include any text outside the JSON object\n\n"
        "Code ({{language}}):\n```{{language}}\n{{code}}\n```"
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
        """Returns the centralized system prompt (used by rewrite)."""
        return cls.SYSTEM_PROMPT

    @classmethod
    def get_review_system_prompt(cls) -> str:
        """Returns the review-specific system prompt (strict JSON output)."""
        return cls.REVIEW_SYSTEM_PROMPT

    @classmethod
    def preprocess_code(cls, code: str) -> str:
        """Adds line numbers to source code for LLM accuracy."""
        lines = code.split("\n")
        numbered_lines = [f"{i + 1} | {line}" for i, line in enumerate(lines)]
        return "\n".join(numbered_lines)

    @classmethod
    def build_review_prompt(cls, language: str, review_focus: str, code: str) -> str:
        """Constructs token-optimized user prompt for code review."""
        numbered_code = cls.preprocess_code(code)
        prompt = cls.REVIEW_PROMPT_TEMPLATE.replace("{{language}}", language)
        prompt = prompt.replace("{{review_focus}}", review_focus)
        prompt = prompt.replace("{{code}}", numbered_code)
        return prompt

    @classmethod
    def build_rewrite_prompt(cls, language: str, code: str) -> str:
        """Constructs token-optimized user prompt for code rewrite."""
        prompt = cls.REWRITE_PROMPT_TEMPLATE.replace("{{language}}", language)
        prompt = prompt.replace("{{code}}", code)
        return prompt
