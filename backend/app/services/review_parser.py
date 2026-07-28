"""
Review Response Parser Module.

Converts raw LLM output (expected to be a JSON object) into a
StructuredReviewData instance.

Responsibilities:
  - Strip any accidental markdown fences the LLM may wrap around JSON.
  - Parse the JSON blob.
  - Normalise every field (severity values, confidence clamp, sequential ids).
  - Compute the severity count summary.
  - Generate the `markdown` backward-compatibility field from structured data.
  - Return a safe fallback `ReviewData(review=...)` dict on ANY parsing failure
    so the API never crashes.

Does NOT:
  - Call the LLM (→ GroqClient).
  - Build prompts (→ PromptBuilder).
  - Store review state (→ ReviewService cache).

Design decisions:
  - A single public method `parse` returns a plain dict (model_dump()) so
    ReviewService stays decoupled from the Pydantic model internals.
  - All normalisation is self-contained — no side-effects.
  - The fallback `{"review": <raw_text>}` preserves backward compatibility
    with any frontend running the legacy markdown path.
"""

import json
import re
from typing import Any, Dict, List, Optional

from app.schemas.responses import IssueItem, SeverityCounts, StructuredReviewData
from app.utils.logger import logger


# ── Constants ─────────────────────────────────────────────────────────────────

VALID_SEVERITIES = {"critical", "high", "medium", "low"}
VALID_FIX_TYPES  = {"replace", "insert", "delete", "refactor"}

# Severity normalization — map common LLM aliases to canonical values
SEVERITY_ALIASES: Dict[str, str] = {
    "critical":      "critical",
    "blocker":       "critical",
    "fatal":         "critical",
    "error":         "high",
    "high":          "high",
    "major":         "high",
    "warning":       "medium",
    "medium":        "medium",
    "moderate":      "medium",
    "minor":         "low",
    "low":           "low",
    "info":          "low",
    "informational": "low",
    "note":          "low",
    "hint":          "low",
}


# ── Review Parser ─────────────────────────────────────────────────────────────

class ReviewParser:
    """
    Parses raw LLM output into a structured review payload.

    Usage:
        payload_dict = ReviewParser.parse(raw_completion)
        # payload_dict is either a StructuredReviewData.model_dump()
        # or a {"review": "<markdown>"} fallback dict.
    """

    # ── Public API ────────────────────────────────────────────────────────────

    @classmethod
    def parse(cls, raw_text: str) -> Dict[str, Any]:
        """
        Main entry point. Parses raw LLM text into a structured dict.

        On success:
            Returns StructuredReviewData.model_dump() — contains `issues`,
            `severity`, `summary`, `strengths`, `recommendations`, `markdown`.

        On any failure:
            Returns {"review": <cleaned_text>} for backward-compatible
            markdown rendering.

        Args:
            raw_text: Raw completion string from the LLM.

        Returns:
            Dict suitable for SuccessResponse.data.
        """
        if not raw_text or not raw_text.strip():
            logger.warning("[ReviewParser] Empty LLM response received.")
            return {"review": ""}

        # Step 1: Strip markdown fences the LLM may have wrapped around JSON
        cleaned = cls._strip_fences(raw_text.strip())

        # Step 2: Parse JSON
        raw_dict = cls._parse_json(cleaned)
        if raw_dict is None:
            logger.warning("[ReviewParser] JSON parsing failed — falling back to markdown.")
            return {"review": cleaned}

        # Step 3: Validate top-level structure
        if not isinstance(raw_dict, dict):
            logger.warning("[ReviewParser] LLM returned JSON array, not object — falling back.")
            return {"review": cleaned}

        # Step 4: Build the structured data model
        try:
            structured = cls._build_structured(raw_dict)
        except Exception as exc:
            logger.error(f"[ReviewParser] Failed to build structured model: {exc}", exc_info=True)
            return {"review": cleaned}

        logger.info(
            f"[ReviewParser] Parsed structured review: "
            f"{len(structured.issues)} issues | "
            f"critical={structured.severity.critical} "
            f"high={structured.severity.high} "
            f"medium={structured.severity.medium} "
            f"low={structured.severity.low}"
        )

        return structured.model_dump()

    # ── Private: JSON Extraction ──────────────────────────────────────────────

    @classmethod
    def _strip_fences(cls, text: str) -> str:
        """
        Removes markdown code fences from the LLM response.

        Handles:
          - ```json ... ``` (most common LLM wrapping)
          - ```python ... ``` or generic language fences
          - Inline text before/after the JSON object

        Falls back to the raw text if no fence is detected.
        """
        # Pattern: ```<lang>?\n{...}\n```
        fence_pattern = re.compile(
            r"```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```",
            re.DOTALL,
        )
        match = fence_pattern.search(text)
        if match:
            candidate = match.group(1).strip()
            if candidate.startswith("{"):
                return candidate

        # Try to extract the outermost JSON object directly
        # (handles cases where LLM adds prose before/after)
        brace_match = re.search(r"\{[\s\S]*\}", text, re.DOTALL)
        if brace_match:
            return brace_match.group(0)

        return text

    @classmethod
    def _parse_json(cls, text: str) -> Optional[Dict[str, Any]]:
        """
        Attempts to parse a string as JSON with multi-layered repair strategies.
        Handles unescaped control characters (strict=False), trailing commas,
        Python booleans (True/False/None), and trailing garbage.
        """
        # Attempt 1: Standard parsing with strict=False (allows unescaped newlines/tabs in string values)
        try:
            return json.loads(text, strict=False)
        except json.JSONDecodeError:
            pass

        # Attempt 2: Truncate trailing garbage after the last closing brace '}'
        try:
            idx = text.rfind("}")
            if idx != -1:
                return json.loads(text[: idx + 1], strict=False)
        except json.JSONDecodeError:
            pass

        # Attempt 3: Apply JSON cleanup transformations (trailing commas, Python booleans)
        repaired = text
        repaired = re.sub(r",\s*([\}\]])", r"\1", repaired)
        repaired = re.sub(r"\bTrue\b", "true", repaired)
        repaired = re.sub(r"\bFalse\b", "false", repaired)
        repaired = re.sub(r"\bNone\b", "null", repaired)

        try:
            return json.loads(repaired, strict=False)
        except json.JSONDecodeError:
            pass

        # Attempt 4: Truncate after last closing brace on repaired text
        try:
            idx = repaired.rfind("}")
            if idx != -1:
                return json.loads(repaired[: idx + 1], strict=False)
        except json.JSONDecodeError as exc:
            logger.debug(f"[ReviewParser] All json parsing attempts failed: {exc}")

        return None

    # ── Private: Model Building ───────────────────────────────────────────────

    @classmethod
    def _build_structured(cls, raw: Dict[str, Any]) -> StructuredReviewData:
        """
        Converts the raw parsed dict into a validated StructuredReviewData.

        All normalisation happens here:
          - Severity values are canonicalized.
          - Confidence is clamped to [0.0, 1.0].
          - Issue ids are reassigned sequentially (1, 2, 3, …).
          - Severity counts are recomputed from the issues list (not trusted from LLM).
          - The markdown field is generated from structured data.
        """
        # ── Issues ────────────────────────────────────────────────────────────
        raw_issues = raw.get("issues", [])
        if not isinstance(raw_issues, list):
            raw_issues = []

        issues: List[IssueItem] = []
        for idx, raw_issue in enumerate(raw_issues, start=1):
            if not isinstance(raw_issue, dict):
                continue
            try:
                issue = cls._build_issue(raw_issue, sequential_id=idx)
                issues.append(issue)
            except Exception as exc:
                logger.warning(f"[ReviewParser] Skipping malformed issue #{idx}: {exc}")

        # ── Severity Counts — recomputed from issues (don't trust LLM counts) ─
        counts = cls._compute_severity_counts(issues)

        # ── Strengths / Recommendations ───────────────────────────────────────
        strengths       = cls._extract_str_list(raw.get("strengths", []))
        recommendations = cls._extract_str_list(raw.get("recommendations", []))

        # ── Summary ───────────────────────────────────────────────────────────
        summary = str(raw.get("summary", "")).strip()

        # ── Markdown (backward-compatibility field) ───────────────────────────
        markdown_field = str(raw.get("markdown", "")).strip()
        if not markdown_field:
            markdown_field = cls._generate_markdown(summary, issues, strengths, recommendations)

        return StructuredReviewData(
            summary         = summary,
            severity        = counts,
            issues          = issues,
            strengths       = strengths,
            recommendations = recommendations,
            markdown        = markdown_field,
        )

    @classmethod
    def _build_issue(cls, raw: Dict[str, Any], sequential_id: int) -> IssueItem:
        """
        Builds and validates a single IssueItem from a raw dict.

        Args:
            raw: Unvalidated issue dict from LLM JSON.
            sequential_id: Override id to ensure sequential numbering.

        Returns:
            Validated IssueItem.
        """
        # Normalize severity
        raw_severity = str(raw.get("severity", "low")).strip().lower()
        severity = SEVERITY_ALIASES.get(raw_severity, "low")

        # Clamp confidence to [0.0, 1.0]
        raw_conf = raw.get("confidence")
        confidence: Optional[float] = None
        if raw_conf is not None:
            try:
                confidence = max(0.0, min(1.0, float(raw_conf)))
            except (TypeError, ValueError):
                confidence = None

        # Normalize integer fields (line, column, endLine, endColumn)
        def _int_or_none(val: Any) -> Optional[int]:
            if val is None:
                return None
            try:
                parsed = int(val)
                return parsed if parsed > 0 else None
            except (TypeError, ValueError):
                return None

        # Normalize fixType
        raw_fix_type = str(raw.get("fixType", "")).strip().lower()
        fix_type = raw_fix_type if raw_fix_type in VALID_FIX_TYPES else None

        return IssueItem(
            id          = sequential_id,
            severity    = severity,
            category    = str(raw.get("category", "")).strip() or None,
            confidence  = confidence,
            title       = str(raw.get("title", "Unnamed Issue")).strip(),
            description = str(raw.get("description", "")).strip(),
            line        = _int_or_none(raw.get("line")),
            column      = _int_or_none(raw.get("column")),
            endLine     = _int_or_none(raw.get("endLine")),
            endColumn   = _int_or_none(raw.get("endColumn")),
            suggestion  = str(raw.get("suggestion", "")).strip() or None,
            fixSnippet  = str(raw.get("fixSnippet", "")).strip() or None,
            fixType     = fix_type,
        )

    @classmethod
    def _compute_severity_counts(cls, issues: List[IssueItem]) -> SeverityCounts:
        """Recomputes severity counts from the validated issues list."""
        counts: Dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for issue in issues:
            if issue.severity in counts:
                counts[issue.severity] += 1
        return SeverityCounts(**counts)

    @classmethod
    def _extract_str_list(cls, raw: Any) -> List[str]:
        """Coerces a raw value into a list of non-empty strings."""
        if not isinstance(raw, list):
            return []
        return [str(item).strip() for item in raw if str(item).strip()]

    # ── Private: Markdown Generation ──────────────────────────────────────────

    @classmethod
    def _generate_markdown(
        cls,
        summary: str,
        issues: List[IssueItem],
        strengths: List[str],
        recommendations: List[str],
    ) -> str:
        """
        Generates a Markdown string from structured data.

        Used as the `markdown` backward-compatibility field when the LLM
        does not include one in its JSON response.
        """
        parts: List[str] = []

        if summary:
            parts.append(f"## Summary\n\n{summary}")

        if strengths:
            bullet_list = "\n".join(f"- {s}" for s in strengths)
            parts.append(f"## Strengths\n\n{bullet_list}")

        if issues:
            issue_lines: List[str] = ["## Issues"]
            sev_order = ["critical", "high", "medium", "low"]
            grouped: Dict[str, List[IssueItem]] = {s: [] for s in sev_order}
            for issue in issues:
                grouped.setdefault(issue.severity, []).append(issue)

            for sev in sev_order:
                group = grouped.get(sev, [])
                if not group:
                    continue
                issue_lines.append(f"\n### {sev.capitalize()}")
                for issue in group:
                    line_ref = f" (Line {issue.line})" if issue.line else ""
                    issue_lines.append(f"\n**{issue.title}**{line_ref}")
                    issue_lines.append(f"{issue.description}")
                    if issue.suggestion:
                        issue_lines.append(f"> 💡 {issue.suggestion}")
                    if issue.fixSnippet:
                        issue_lines.append(f"```\n{issue.fixSnippet}\n```")

            parts.append("\n".join(issue_lines))

        if recommendations:
            bullet_list = "\n".join(f"{i + 1}. {r}" for i, r in enumerate(recommendations))
            parts.append(f"## Recommendations\n\n{bullet_list}")

        return "\n\n".join(parts)
