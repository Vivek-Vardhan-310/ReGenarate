"""
Groq API Client & Provider Module.

Implements the AI Provider layer specifically for the Groq inference SDK.
Per Architecture (docs/02-Architecture.md, Section 18 & 19):
- Authenticates requests using GROQ_API_KEY.
- Configures model name, temperature, max tokens, and timeouts.
- Translates Groq SDK errors into application-specific exceptions (AIProviderError, AITimeoutError).
- Measures execution latency.
"""

import asyncio
from typing import Optional
from groq import AsyncGroq, GroqError

from app.config.settings import settings
from app.utils.exceptions import AIProviderError, AITimeoutError, ConfigurationError
from app.utils.logger import logger


class GroqClient:
    """
    Groq API client wrapper handling authentication, inference execution,
    timeouts, and exception handling.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout: Optional[int] = None,
    ) -> None:
        """
        Initializes the Groq client instance.

        Args:
            api_key: Groq API key (defaults to settings.GROQ_API_KEY).
            model_name: LLM model identifier.
            temperature: Creativity setting (0.0 to 1.0).
            max_tokens: Max completion tokens.
            timeout: Request timeout in seconds.
        """
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model_name = model_name or settings.MODEL_NAME
        self.temperature = temperature if temperature is not None else settings.TEMPERATURE
        self.max_tokens = max_tokens or settings.MAX_TOKENS
        self.timeout = timeout or settings.REQUEST_TIMEOUT

        if self.api_key:
            self._client = AsyncGroq(api_key=self.api_key)
        else:
            self._client = None

    def is_configured(self) -> bool:
        """Checks if the Groq API key is present."""
        return bool(self.api_key and self.api_key.strip())

    async def generate_completion(self, system_prompt: str, user_prompt: str) -> str:
        """
        Sends a completion request to Groq API using Llama 3.3.

        Args:
            system_prompt: System role instructions.
            user_prompt: User request prompt.

        Returns:
            Raw generated string response from Groq.

        Raises:
            ConfigurationError: If API key is missing.
            AITimeoutError: If API request exceeds timeout.
            AIProviderError: If Groq API returns an error.
        """
        if not self.is_configured():
            raise ConfigurationError(
                "GROQ_API_KEY is not configured in backend environment (.env). "
                "Please set GROQ_API_KEY to execute AI operations."
            )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        logger.info(
            f"Sending completion request to Groq API | Model: {self.model_name} | "
            f"Temp: {self.temperature} | Timeout: {self.timeout}s"
        )

        try:
            # Wrap execution with timeout
            response = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                ),
                timeout=float(self.timeout),
            )

            if not response.choices or not response.choices[0].message.content:
                raise AIProviderError("Groq API returned an empty completion choice.")

            content = response.choices[0].message.content
            logger.info("Successfully received response from Groq API.")
            return content

        except asyncio.TimeoutError:
            logger.error(f"Groq API request timed out after {self.timeout} seconds.")
            raise AITimeoutError(f"AI generation timed out after {self.timeout} seconds.")

        except GroqError as exc:
            logger.error(f"Groq SDK Error: {exc}")
            raise AIProviderError(f"Groq API error: {str(exc)}")

        except Exception as exc:
            logger.error(f"Unexpected error communicating with Groq API: {exc}", exc_info=True)
            raise AIProviderError("Failed to communicate with AI provider.")
