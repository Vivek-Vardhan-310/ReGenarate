"""
Rewrite Service Module.

Orchestrates the code rewrite workflow.
Per Architecture (docs/02-Architecture.md, Section 16 & 33):
- Checks in-memory ResponseCache to avoid duplicate LLM inferences.
- Uses PromptBuilder to construct system and rewrite prompts.
- Calls AI Provider (GroqClient) for LLM completion.
- Parses completion via ResponseParser.
- Stores result in cache and returns standardized SuccessResponse.
"""

from typing import Optional
from app.schemas.requests import RewriteRequest
from app.schemas.responses import RewriteData, SuccessResponse
from app.services.groq_client import GroqClient
from app.services.parser import ResponseParser
from app.services.prompt_builder import PromptBuilder
from app.utils.cache import rewrite_cache
from app.utils.helpers import truncate_string
from app.utils.logger import logger


class RewriteService:
    """
    Business logic service for managing source code rewrites.
    """

    def __init__(self, groq_client: Optional[GroqClient] = None) -> None:
        """
        Initializes the RewriteService with dependency injection.

        Args:
            groq_client: Optional GroqClient instance.
        """
        self.groq_client = groq_client or GroqClient()

    async def generate_rewrite(self, request: RewriteRequest) -> SuccessResponse:
        """
        Executes the AI code rewrite pipeline with caching optimization.

        Args:
            request: Validated RewriteRequest payload.

        Returns:
            SuccessResponse containing RewriteData object.
        """
        # 1. Generate Cache Key & Check Cache
        cache_payload = {
            "language": request.language,
            "code": request.code,
        }
        cache_key = rewrite_cache.generate_key("rewrite", cache_payload)
        cached_result = rewrite_cache.get(cache_key)

        if cached_result is not None:
            logger.info("Serving rewrite response from in-memory cache.")
            return SuccessResponse(
                success=True,
                data=cached_result,
                message="Rewrite served from cache.",
            )

        logger.info(
            f"Processing rewrite request | Language: {request.language} | "
            f"Code length: {len(request.code)} chars"
        )
        logger.debug(f"Code snippet: {truncate_string(request.code, 60)}")

        # 2. Build Prompts
        system_prompt = PromptBuilder.get_system_prompt()
        user_prompt = PromptBuilder.build_rewrite_prompt(
            language=request.language,
            code=request.code,
        )

        # 3. Check configuration mode
        if not self.groq_client.is_configured():
            logger.warning("GROQ_API_KEY is missing. Returning demonstration code for rewrite.")
            mock_code = (
                f"// Optimized {request.language.title()} Implementation\n"
                f"// Note: Configure GROQ_API_KEY in backend/.env for live AI rewrites.\n\n"
                f"{request.code}"
            )
            rewrite_payload = RewriteData(rewritten_code=mock_code).model_dump()
            rewrite_cache.set(cache_key, rewrite_payload)

            return SuccessResponse(
                success=True,
                data=rewrite_payload,
                message="Rewrite generated in demonstration mode (GROQ_API_KEY missing).",
            )

        # 4. Call AI Provider & Parse Response
        raw_completion = await self.groq_client.generate_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        parsed_code = ResponseParser.parse_rewrite_response(raw_completion)
        rewrite_payload = RewriteData(rewritten_code=parsed_code).model_dump()

        # 5. Store in Cache
        rewrite_cache.set(cache_key, rewrite_payload)

        return SuccessResponse(
            success=True,
            data=rewrite_payload,
            message="Rewrite generated successfully.",
        )
