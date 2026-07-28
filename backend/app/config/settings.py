"""
Application Settings Module.

Loads and validates environment variables using Pydantic Settings.
Provides a single, type-safe configuration object used throughout
the application. No configuration value should be hardcoded
elsewhere in the codebase.

Usage:
    from app.config.settings import settings
    api_key = settings.GROQ_API_KEY
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables.

    All values can be overridden via a `.env` file placed in
    the `backend/` directory, or via system environment variables.

    Attributes:
        GROQ_API_KEY: API key for the Groq inference platform.
        MODEL_NAME: Identifier for the LLM model to use.
        TEMPERATURE: Controls randomness in AI responses (0.0–1.0).
        MAX_TOKENS: Maximum number of tokens in AI responses.
        HOST: Server bind address.
        PORT: Server bind port.
        REQUEST_TIMEOUT: Maximum seconds to wait for AI responses.
        DEBUG: Enable debug mode for development.
        APP_ENV: Current application environment.
    """

    # ------------------------------------------
    # AI Provider Configuration
    # ------------------------------------------
    GROQ_API_KEY: str = ""
    MODEL_NAME: str = "llama-3.3-70b-versatile"
    TEMPERATURE: float = 0.3
    MAX_TOKENS: int = 4096

    # ------------------------------------------
    # Server Configuration
    # ------------------------------------------
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ------------------------------------------
    # JDoodle Execution Service Configuration
    # ------------------------------------------
    JDOODLE_CLIENT_ID: str = ""
    JDOODLE_CLIENT_SECRET: str = ""
    JDOODLE_API_URL: str = "https://api.jdoodle.com/v1/execute"
    JDOODLE_TIMEOUT: int = 15

    # ------------------------------------------
    # Application Settings
    # ------------------------------------------
    REQUEST_TIMEOUT: int = 30
    DEBUG: bool = False
    APP_ENV: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# Singleton settings instance used throughout the application
settings = Settings()
