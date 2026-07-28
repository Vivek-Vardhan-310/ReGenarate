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
        # TEMPORARY DEBUGGING BYPASS
        logger.info(f"Quick Fix generation completed successfully for Issue ID: {request.issue.id}. BYPASSING PARSER.")
        print("\n" + "=" * 80)
        print("RAW QUICK FIX RESPONSE (BYPASS)")
        print("=" * 80)
        print(raw_response)
        print("=" * 80 + "\n")
        
        try:
            import json
            # strict=False allows unescaped control characters like literal newlines in JSON strings
            
            # Clean markdown fences just in case
            cleaned_response = raw_response.strip()
            if cleaned_response.startswith("```"):
                lines = cleaned_response.splitlines()
                if len(lines) >= 2:
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines[-1].strip() == "```":
                        lines = lines[:-1]
                cleaned_response = "\n".join(lines).strip()
                
            parsed_raw = json.loads(cleaned_response, strict=False)
            
            from app.schemas.responses import QuickFixData, ChangedLine
            
            qf_data = QuickFixData(
                fixedCode=parsed_raw.get("fixedCode", ""),
                explanation=parsed_raw.get("explanation", ""),
                changedLines=[
                    ChangedLine(**line) for line in parsed_raw.get("changedLines", [])
                ],
                issueId=request.issue.id,
                success=True,
                confidence=parsed_raw.get("confidence", 0.0),
                model=self.client.model_name
            )
            
            return SuccessResponse(
                data=qf_data,
                message="Quick fix generated successfully (BYPASS ACTIVE)."
            )
        except Exception as e:
            logger.error(f"Manual bypass parse failed: {e}")
            # If the LLM response is truly malformed, return it raw so the developer can see it
            return SuccessResponse(
                data={"rawResponse": raw_response, "parse_error": str(e)},
                message="Quick fix fallback returned (BYPASS ACTIVE)."
            )
