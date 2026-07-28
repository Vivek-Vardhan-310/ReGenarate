"""
Review Service Module.

Orchestrates the code review workflow.
Per Architecture (docs/02-Architecture.md, Section 15 & 33):
- Checks in-memory ResponseCache to avoid duplicate LLM inferences.
- Uses PromptBuilder to construct system and user prompts.
- Calls AI Provider (GroqClient) for LLM completion.
- Parses completion via ResponseParser.
- Stores result in cache and returns standardized SuccessResponse.
"""

from typing import Optional
from app.schemas.requests import ReviewRequest
from app.schemas.responses import ReviewData, SuccessResponse
from app.services.groq_client import GroqClient
from app.services.parser import ResponseParser
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

        Args:
            request: Validated ReviewRequest payload.

        Returns:
            SuccessResponse containing ReviewData object.
        """
        # 1. Generate Cache Key & Check Cache
        cache_payload = {
            "language": request.language,
            "focus": request.review_focus,
            "code": request.code,
            "execution": request.execution.model_dump() if request.execution else None,
        }
        cache_key = review_cache.generate_key("review", cache_payload)
        cached_result = review_cache.get(cache_key)

        if cached_result is not None:
            logger.info("Serving review response from in-memory cache.")
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

        # 2. Build Prompts
        system_prompt = PromptBuilder.get_system_prompt()
        user_prompt = PromptBuilder.build_review_prompt(
            language=request.language,
            review_focus=request.review_focus,
            code=request.code,
            execution=request.execution,
        )

        # 3. Check configuration mode
        if not self.groq_client.is_configured():
            logger.warning("GROQ_API_KEY is missing. Returning mock review response for demonstration.")
            if request.execution and (request.execution.status == "failed" or request.execution.exit_code != 0 or request.execution.stderr):
                mock_markdown = (
                    f"# Summary\n\n"
                    f"Execution failed with exit code `{request.execution.exit_code}`.\n\n"
                    f"# Detected Runtime Issues\n\n"
                    f"**Stderr trace:**\n```\n{request.execution.stderr or 'Runtime error detected'}\n```\n\n"
                    f"# Probable Cause\n\n"
                    f"Runtime exception or unhandled condition during program execution. Confidence: **High**.\n\n"
                    f"# Suggested Fix\n\n"
                    f"1. Add exception handling or boundary checks.\n"
                    f"2. Verify inputs before execution.\n\n"
                    f"# Improved Code\n\n"
                    f"```{request.language}\n# Configure GROQ_API_KEY for live AI debugging\n```\n\n"
                    f"# Additional Recommendations\n\n"
                    f"- Set GROQ_API_KEY in backend/.env for live LLM debugging."
                )
            else:
                mock_markdown = (
                    f"# Summary\n\n"
                    f"Your **{request.language.title()}** implementation was reviewed focusing on **{request.review_focus.title()}**.\n\n"
                    f"# Strengths\n\n"
                    f"- Clean function signature and clear logical intent.\n"
                    f"- Input code processed successfully through the backend pipeline.\n\n"
                    f"# Issues\n\n"
                    f"- `[Config]` `GROQ_API_KEY` is not set in `.env`. Configure a valid key for live LLM inference.\n\n"
                    f"# Recommendations\n\n"
                    f"1. Set `GROQ_API_KEY=your_key` in `backend/.env`.\n"
                    f"2. Ensure input variables are properly typed.\n\n"
                    f"# Example Improvements\n\n"
                    f"```{request.language}\n# Configure GROQ_API_KEY to test live Llama 3.3 output\n```"
                )

            review_payload = ReviewData(review=mock_markdown).model_dump()
            review_cache.set(cache_key, review_payload)

            return SuccessResponse(
                success=True,
                data=review_payload,
                message="Review generated in demonstration mode (GROQ_API_KEY missing).",
            )

        # 4. Call AI Provider & Parse Response
        raw_completion = await self.groq_client.generate_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        parsed_review = ResponseParser.parse_review_response(raw_completion)
        review_payload = ReviewData(review=parsed_review).model_dump()

        # 5. Store in Cache
        review_cache.set(cache_key, review_payload)

        return SuccessResponse(
            success=True,
            data=review_payload,
            message="Review generated successfully.",
        )
