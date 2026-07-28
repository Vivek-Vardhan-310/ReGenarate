"""
Quick Fix Service Module.

Handles business logic for the AI Quick Fix feature. Orchestrates
prompts, Groq API communication, and parsing for targeted issue fixes.
"""

import logging

from fastapi import HTTPException, status

from app.schemas.requests import QuickFixRequest
from app.schemas.responses import SuccessResponse
from app.services.groq_client import GroqClient
from app.services.prompt_builder import PromptBuilder
from app.services.quick_fix_parser import QuickFixParser
from app.utils.logger import logger


class QuickFixService:
    """
    Business logic layer for Quick Fix operations.
    Receives validated requests, interfaces with the Groq client,
    and returns a fully parsed SuccessResponse.
    """

    def __init__(self):
        """Initializes the service and the Groq client dependency."""
        self.client = GroqClient()
        # Use a distinct cache key space for quick fixes to avoid conflicts
        self.cache_key_prefix = "quickfix_json"

    async def generate_quick_fix(self, request: QuickFixRequest) -> SuccessResponse:
        """
        Executes the AI quick fix generation pipeline.

        Args:
            request: Validated QuickFixRequest payload.

        Returns:
            SuccessResponse wrapping the parsed QuickFixData.

        Raises:
            HTTPException: If the AI API fails completely.
        """
        logger.info(f"Starting Quick Fix generation for language: {request.language}, Issue ID: {request.issue.id}")

        # 1. Build Prompts
        system_prompt = PromptBuilder.get_quick_fix_system_prompt()
        user_prompt = PromptBuilder.build_quick_fix_prompt(
            language=request.language,
            code=request.code,
            issue=request.issue.model_dump()
        )

        # 2. Execute Model Request
        try:
            # We want strict JSON back from the model
            raw_response = await self.client.generate_completion(
                system_prompt=system_prompt,
                user_prompt=user_prompt
            )
        except Exception as e:
            logger.error(f"Groq API failure during quick fix: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service is currently unavailable. Please try again later.",
            )

        # 3. Parse and Validate Response
        parsed_data = QuickFixParser.parse(
            raw_response=raw_response,
            original_code=request.code,
            issue=request.issue,
            model_name=self.client.model_name
        )

        logger.info(
            f"Quick Fix generation completed for Issue ID: {request.issue.id}. "
            f"Success={parsed_data.success}"
        )

        # 4. Construct Final Response
        return SuccessResponse(
            data=parsed_data,
            message="Quick fix generated successfully." if parsed_data.success else "Quick fix fallback returned.",
        )
