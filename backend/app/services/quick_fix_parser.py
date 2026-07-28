"""
Quick Fix Parser Module.

Parses unstructured or semi-structured LLM JSON responses into strongly typed
QuickFixData Pydantic models. Includes robust fallback mechanisms for malformed LLM outputs.
"""

import json
import logging
from typing import Optional

from app.schemas.responses import QuickFixData, ChangedLine
from app.schemas.requests import QuickFixIssue

logger = logging.getLogger(__name__)

class QuickFixParser:
    """
    Parses and sanitizes LLM JSON output into a structured QuickFixData payload.
    Ensures the API never crashes due to malformed AI responses.
    """

    @classmethod
    def parse(
        cls, 
        raw_response: str, 
        original_code: str, 
        issue: QuickFixIssue,
        model_name: Optional[str] = None
    ) -> QuickFixData:
        """
        Parses raw text from the LLM, strips markdown, and validates JSON.

        Args:
            raw_response: The raw string response from the LLM.
            original_code: The original source code sent to the LLM.
            issue: The QuickFixIssue that was requested to be fixed.
            model_name: The name of the AI model used.

        Returns:
            QuickFixData: A fully validated response payload.
        """
        # ── Stage 1: Strip Markdown Fences ───────────────────────────────────
        cleaned_response = raw_response.strip()
        if cleaned_response.startswith("```"):
            fence_lines = cleaned_response.splitlines()
            if len(fence_lines) >= 2:
                if fence_lines[0].startswith("```"):
                    fence_lines = fence_lines[1:]
                if fence_lines[-1].strip() == "```":
                    fence_lines = fence_lines[:-1]
            cleaned_response = "\n".join(fence_lines).strip()

        # ── Stage 2: Strict JSON parse (preferred) ────────────────────────────
        parsed_data = None
        try:
            parsed_data = json.loads(cleaned_response)
            logger.debug("Quick Fix response parsed with strict JSON.")
        except json.JSONDecodeError as strict_err:
            # ── Stage 3: Non-strict fallback (handles literal \\n in strings) ──
            # LLMs sometimes emit unescaped control characters inside JSON strings.
            # strict=False permits these while still requiring valid JSON structure.
            logger.warning(
                f"Strict JSON parse failed ({strict_err}). "
                "Retrying with strict=False."
            )
            try:
                parsed_data = json.loads(cleaned_response, strict=False)
                logger.info("Quick Fix response recovered with strict=False parse.")
            except (json.JSONDecodeError, ValueError, TypeError) as lenient_err:
                logger.error(
                    f"Both strict and lenient JSON parses failed: {lenient_err}"
                )
                print("\n" + "=" * 80)
                print("RAW QUICK FIX RESPONSE (PARSE FAILED)")
                print("=" * 80)
                print(raw_response)
                print("=" * 80 + "\n")
                return cls._build_fallback(original_code, issue, str(lenient_err), model_name)

        # ── Stage 4: Inject missing metadata ─────────────────────────────────
        try:
            if "issueId" not in parsed_data:
                parsed_data["issueId"] = issue.id
            if "model" not in parsed_data and model_name:
                parsed_data["model"] = model_name

            # ── Stage 5: Validate against Pydantic schema ─────────────────────
            return QuickFixData(**parsed_data)

        except (ValueError, TypeError, KeyError) as e:
            logger.error(f"Pydantic validation failed for Quick Fix response: {e}")
            return cls._build_fallback(original_code, issue, str(e), model_name)

    @classmethod
    def _build_fallback(
        cls, 
        original_code: str, 
        issue: QuickFixIssue, 
        error_msg: str,
        model_name: Optional[str]
    ) -> QuickFixData:
        """
        Constructs a safe fallback response if parsing completely fails.
        Returns the original code unmodified.
        """
        return QuickFixData(
            fixedCode=original_code,
            explanation=f"AI failed to generate a valid structured fix. Internal Error: {error_msg}",
            changedLines=[],
            issueId=issue.id,
            success=False,
            confidence=0.0,
            model=model_name
        )
