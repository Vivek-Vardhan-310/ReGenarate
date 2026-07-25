"""
Response Parser Module.

Converts raw AI text outputs into standardized application payloads.
Per Architecture (docs/02-Architecture.md, Section 20):
- Cleans Markdown responses for review requests.
- Strips code fences (```lang ... ```), backticks, and leading/trailing commentary for rewrites.
- Ensures consistent output structure regardless of minor LLM variability.
"""

import re
from app.utils.logger import logger
from app.utils.exceptions import ParsingError


class ResponseParser:
    """
    Parses and sanitizes raw LLM output.
    """

    @classmethod
    def parse_review_response(cls, raw_text: str) -> str:
        """
        Parses and cleans raw AI review output.

        Args:
            raw_text: Raw completion text from LLM.

        Returns:
            Sanitized Markdown string.
        """
        if not raw_text or not raw_text.strip():
            raise ParsingError("AI returned an empty review response.")

        cleaned = raw_text.strip()

        # If LLM wrapped entire Markdown in a ```markdown fence, strip top and bottom fence
        if cleaned.startswith("```markdown") and cleaned.endswith("```"):
            cleaned = cleaned[11:-3].strip()
        elif cleaned.startswith("```") and cleaned.endswith("```"):
            cleaned = cleaned[3:-3].strip()

        return cleaned

    @classmethod
    def parse_rewrite_response(cls, raw_text: str) -> str:
        """
        Parses and extracts pure source code from raw AI rewrite output.

        Strips triple-backtick markdown blocks (e.g. ```python ... ```),
        introductory text, and trailing explanations.

        Args:
            raw_text: Raw completion text from LLM.

        Returns:
            Clean source code string.
        """
        if not raw_text or not raw_text.strip():
            raise ParsingError("AI returned an empty rewrite response.")

        cleaned = raw_text.strip()

        # If text is enclosed in outer ```...``` fences, strip outer pair
        if cleaned.startswith("```") and cleaned.endswith("```"):
            # Strip first line containing ```lang
            lines = cleaned.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        # If commentary text precedes code block, extract ```lang ... ```
        code_block_pattern = re.compile(r"```(?:\w+)?\n([\s\S]*?)\n```", re.DOTALL)
        matches = code_block_pattern.findall(cleaned)

        if matches:
            # Pick non-empty match with largest length
            valid_matches = [m.strip() for m in matches if m.strip()]
            if valid_matches:
                cleaned = max(valid_matches, key=len)

        # Final pass: remove any leftover fence markers
        cleaned = re.sub(r"^```(?:\w+)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

        return cleaned
