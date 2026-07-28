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

from app.schemas.requests import ReviewRequest
from app.schemas.responses import ReviewData, StructuredReviewData, SeverityCounts, IssueItem, SuccessResponse
from app.services.groq_client import GroqClient
from app.services.review_parser import ReviewParser
from app.services.prompt_builder import PromptBuilder
from app.utils.cache import review_cache
from app.utils.helpers import truncate_string
from app.utils.logger import logger


class ReviewService:
    """
    Business logic service for managing source code reviews.
    """

    def __init__(self, groq_client: Optional[GroqClient] = None) -> None:
        """
        Initializes the ReviewService with dependency injection.

        Args:
            groq_client: Optional GroqClient instance.
        """
        self.groq_client = groq_client or GroqClient()

    async def generate_review(self, request: ReviewRequest) -> SuccessResponse:
        """
        Executes the AI code review pipeline with caching optimization.

        Returns a SuccessResponse whose .data is either:
          - StructuredReviewData.model_dump()   → IDE experience
          - {"review": "<markdown>"}             → fallback / demo mode

        Args:
            request: Validated ReviewRequest payload.

        Returns:
            SuccessResponse containing the review payload.
        """
        # 1. Generate Cache Key & Check Cache
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

        mock_markdown = (
            f"# Summary\n\n"
            f"Your **{language.title()}** implementation was reviewed focusing on **{review_focus.title()}**.\n\n"
            f"# Issues\n\n"
            f"- `[Config]` `GROQ_API_KEY` is not set in `.env`. Configure a valid key for live LLM inference.\n\n"
            f"# Recommendations\n\n"
            f"1. Set `GROQ_API_KEY=your_key` in `backend/.env`.\n"
            f"2. Restart the backend server.\n"
        )

        return StructuredReviewData(
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
        ).model_dump()
