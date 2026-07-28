"""
Review Service Module.

Orchestrates the code review workflow.
Per Architecture (docs/02-Architecture.md, Section 15 & 33):
- Checks in-memory ResponseCache to avoid duplicate LLM inferences.
- Uses PromptBuilder to construct system and user prompts.
- Calls AI Provider (GroqClient) for LLM completion.
- Parses completion via ReviewParser (structured JSON) or falls back to ReviewData.
- Stores result in cache and returns standardized SuccessResponse.

Changes from original:
- system_prompt uses PromptBuilder.get_review_system_prompt() (JSON-only).
- LLM completion is parsed by ReviewParser.parse() instead of ResponseParser.
- Mock response now returns a StructuredReviewData payload.
- Fallback to {"review": ...} is handled entirely inside ReviewParser.parse().
"""

import json
from typing import Any, Dict, Optional

from app.schemas.requests import ReviewRequest, ExecutionData
from app.schemas.responses import ReviewData, StructuredReviewData, SeverityCounts, IssueItem, SuccessResponse
from app.services.groq_client import GroqClient
from app.services.jdoodle import JDoodleService
from app.services.review_parser import ReviewParser
from app.services.prompt_builder import PromptBuilder
from app.utils.cache import review_cache
from app.utils.helpers import truncate_string
from app.utils.logger import logger


class ReviewService:
    """
    Business logic service for managing source code reviews.
    """

    def __init__(
        self,
        groq_client: Optional[GroqClient] = None,
        jdoodle_service: Optional[JDoodleService] = None,
    ) -> None:
        """
        Initializes the ReviewService with dependency injection.

        Args:
            groq_client: Optional GroqClient instance.
            jdoodle_service: Optional JDoodleService instance.
        """
        self.groq_client = groq_client or GroqClient()
        self.jdoodle_service = jdoodle_service or JDoodleService()

    async def generate_review(self, request: ReviewRequest) -> SuccessResponse:
        """
        Executes the AI code review pipeline with caching optimization.

        Before sending code to Groq:
        1. Executes the code using JDoodle (if not already executed).
        2. Captures stdout, compiler errors, runtime errors, and status.
        3. Includes execution results in the prompt sent to Groq.

        Args:
            request: Validated ReviewRequest payload.

        Returns:
            SuccessResponse containing the review payload.
        """
        # 1. Execute via JDoodle if execution data is missing or not executed
        if (request.execution is None or request.execution.status == "not_executed") and self.jdoodle_service.is_configured():
            try:
                logger.info(f"Auto-executing code via JDoodle before AI review | Language: {request.language}")
                exec_result = await self.jdoodle_service.execute_code(
                    code=request.code,
                    language=request.language,
                )
                exec_success = exec_result.get("execution_success", False)
                cmp_err = exec_result.get("compiler_errors", "")
                rt_err = exec_result.get("runtime_errors", "")
                status_str = "success" if exec_success else ("compilation_error" if cmp_err else "failed")
                
                request.execution = ExecutionData(
                    status=status_str,
                    exit_code=0 if exec_success else 1,
                    stdout=exec_result.get("stdout", "") or exec_result.get("output", ""),
                    stderr=cmp_err or rt_err,
                    compiler_errors=cmp_err,
                    runtime_errors=rt_err,
                    execution_time_ms=int(float(exec_result.get("cpu_time", "0") or "0") * 1000),
                )
            except Exception as exc:
                logger.warning(f"Auto-execution via JDoodle skipped due to error: {exc}")

        # 2. Generate Cache Key & Check Cache
        cache_payload = {
            "language": request.language,
            "focus": request.review_focus,
            "code": request.code,
            "execution": request.execution.model_dump() if request.execution else None,
        }
        cache_key = review_cache.generate_key("review_structured", cache_payload)
        cached_result = review_cache.get(cache_key)

        if cached_result is not None:
            logger.info("Serving structured review response from in-memory cache.")
            return SuccessResponse(
                success=True,
                data=cached_result,
                message="Review served from cache.",
            )

        exec_status = request.execution.status if request.execution else "not_executed"
        logger.info(
            f"Processing review request | Language: {request.language} | "
            f"Focus: {request.review_focus} | Execution: {exec_status} | "
            f"Code length: {len(request.code)} chars"
        )
        logger.debug(f"Code snippet: {truncate_string(request.code, 60)}")

        # 2. Check configuration mode
        if not self.groq_client.is_configured():
            logger.warning("GROQ_API_KEY is missing. Returning mock structured review for demonstration.")
            mock_payload = self._build_mock_payload(request.language, request.review_focus, request.execution)
            review_cache.set(cache_key, mock_payload)
            return SuccessResponse(
                success=True,
                data=mock_payload,
                message="Review generated in demonstration mode (GROQ_API_KEY missing).",
            )

        # 3. Build Prompts
        system_prompt = PromptBuilder.get_review_system_prompt()
        user_prompt = PromptBuilder.build_review_prompt(
            language=request.language,
            review_focus=request.review_focus,
            code=request.code,
            execution=request.execution,
        )

        # 4. Call AI Provider
        raw_completion = await self.groq_client.generate_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        # 5. Parse Structured Response (with automatic fallback)
        review_payload = ReviewParser.parse(raw_completion)

        if request.execution and isinstance(review_payload, dict):
            review_payload["execution"] = request.execution.model_dump()

        # 6. Store in Cache & Return
        review_cache.set(cache_key, review_payload)

        return SuccessResponse(
            success=True,
            data=review_payload,
            message="Review generated successfully.",
        )

    # ── Private: Mock Response ────────────────────────────────────────────────

    @staticmethod
    def _build_mock_payload(language: str, review_focus: str, execution: Optional[Any] = None) -> Dict[str, Any]:
        """
        Returns a demonstration-mode structured review payload.

        Used when GROQ_API_KEY is not configured so the frontend
        can exercise the full structured review UI path.
        """
        mock_issue = IssueItem(
            id=1,
            severity="high",
            category="Configuration",
            confidence=1.0,
            title="GROQ_API_KEY Not Configured",
            description=(
                "The backend is running in demonstration mode because GROQ_API_KEY "
                "is not set in backend/.env. Live LLM inference is disabled."
            ),
            line=None,
            column=None,
            endLine=None,
            endColumn=None,
            suggestion="Add GROQ_API_KEY=<your_key> to backend/.env and restart the server.",
            fixSnippet="GROQ_API_KEY=gsk_your_key_here",
            fixType="replace",
        )

        is_failed = execution and (
            getattr(execution, "status", None) in ("failed", "compilation_error", "runtime_error")
            or getattr(execution, "exit_code", 0) != 0
            or bool(getattr(execution, "stderr", ""))
        )

        if is_failed:
            err_msg = getattr(execution, "stderr", "") or getattr(execution, "stdout", "") or "Execution error"
            mock_markdown = (
                f"# Summary\nProgram failed during execution.\n\n"
                f"# Detected Runtime Issues\n{err_msg}\n\n"
                f"# Probable Cause\nRuntime exception or error occurred during execution.\n\n"
                f"# Suggested Fix\nInspect the error log and correct the source code logic.\n\n"
                f"# Improved Code\n```\n# Fix applied\n```\n"
            )
        else:
            mock_markdown = (
                f"# Summary\n\n"
                f"Your **{language.title()}** implementation was reviewed focusing on **{review_focus.title()}**.\n\n"
                f"# Strengths\n- Code submitted successfully through the backend pipeline.\n\n"
                f"# Issues\n\n"
                f"- `[Config]` `GROQ_API_KEY` is not set in `.env`. Configure a valid key for live LLM inference.\n\n"
                f"# Recommendations\n\n"
                f"1. Set `GROQ_API_KEY=your_key` in `backend/.env`.\n"
                f"2. Restart the backend server.\n"
            )

        mock_payload = StructuredReviewData(
            summary=(
                f"Running in demonstration mode — GROQ_API_KEY is not configured. "
                f"The {language.title()} code could not be analyzed by the AI. "
                f"Set a valid Groq API key to enable live code review."
            ),
            severity=SeverityCounts(critical=0, high=1, medium=0, low=0),
            issues=[mock_issue],
            strengths=["Code submitted successfully through the backend pipeline."],
            recommendations=[
                "Set GROQ_API_KEY in backend/.env to enable live AI code review.",
                "Restart the uvicorn server after updating .env.",
            ],
            markdown=mock_markdown,
            review=mock_markdown,
        ).model_dump()

        if execution:
            mock_payload["execution"] = execution.model_dump() if hasattr(execution, "model_dump") else execution

        return mock_payload
