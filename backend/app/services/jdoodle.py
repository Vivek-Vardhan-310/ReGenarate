"""
JDoodle Compiler API Service Module.

Handles async communication with the JDoodle code execution API.
Per Architecture (docs/02-Architecture.md):
- Keeps all API credentials on the backend.
- Uses httpx.AsyncClient for non-blocking HTTP requests.
- Maps simple language identifiers to JDoodle targets and version indices.
- Handles network errors, timeouts, invalid credentials, and execution failures cleanly.
- Logs execution events without exposing secrets.
"""

from typing import Any, Dict, Optional
import httpx

from app.config.constants import ERROR_CODES, JDOODLE_LANGUAGE_MAPPING
from app.config.settings import settings
from app.utils.exceptions import (
    AITimeoutError,
    AppBaseError,
    ConfigurationError,
    ValidationError,
)
from app.utils.logger import logger


class JDoodleService:
    """
    Service responsible for executing source code via the JDoodle Compiler API.
    """

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        api_url: Optional[str] = None,
        timeout: Optional[int] = None,
    ) -> None:
        """
        Initializes the JDoodleService with settings defaults.
        """
        self.client_id = client_id or settings.JDOODLE_CLIENT_ID
        self.client_secret = client_secret or settings.JDOODLE_CLIENT_SECRET
        self.api_url = api_url or settings.JDOODLE_API_URL
        self.timeout = timeout or settings.JDOODLE_TIMEOUT

    def is_configured(self) -> bool:
        """Checks if JDoodle credentials are fully configured."""
        return bool(
            self.client_id
            and self.client_id.strip()
            and self.client_secret
            and self.client_secret.strip()
        )

    async def execute_code(
        self,
        code: str,
        language: str,
        stdin: str = "",
    ) -> Dict[str, Any]:
        """
        Executes code using the JDoodle API asynchronously.

        Args:
            code: Source code string.
            language: Simple language name (e.g. 'python', 'cpp', 'java').
            stdin: Optional standard input string.

        Returns:
            Dict containing output, stdout, compiler_errors, runtime_errors,
            memory, cpu_time, execution_success, status_code.

        Raises:
            ConfigurationError: If credentials are not configured.
            ValidationError: If language is unsupported for execution.
            AITimeoutError: If execution request times out.
            AppBaseError: If network or provider error occurs.
        """
        if not self.is_configured():
            logger.error("JDoodle credentials (JDOODLE_CLIENT_ID / JDOODLE_CLIENT_SECRET) are missing.")
            raise ConfigurationError(
                message="JDoodle API credentials are not configured on the backend.",
                error_code=ERROR_CODES["CONFIGURATION_ERROR"],
                status_code=500,
            )

        lang_key = (language or "").strip().lower()
        mapping = JDOODLE_LANGUAGE_MAPPING.get(lang_key)

        if not mapping:
            logger.warning(f"Language '{language}' is not supported for code execution via JDoodle.")
            raise ValidationError(
                message=f"Language '{language}' is not supported for code execution.",
                error_code=ERROR_CODES["UNSUPPORTED_LANGUAGE"],
                status_code=400,
            )

        target_language = mapping["language"]
        version_index = mapping["versionIndex"]

        payload = {
            "clientId": self.client_id,
            "clientSecret": self.client_secret,
            "script": code,
            "language": target_language,
            "versionIndex": version_index,
            "stdin": stdin or "",
        }

        logger.info(
            f"JDoodle request started | Language: {language} -> {target_language} "
            f"(versionIndex: {version_index}) | Code size: {len(code)} chars"
        )

        try:
            async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
                response = await client.post(self.api_url, json=payload)

            if response.status_code in (401, 403):
                logger.error(f"JDoodle authentication failed with HTTP status {response.status_code}.")
                raise ConfigurationError(
                    message="Invalid JDoodle API credentials. Access unauthorized.",
                    error_code=ERROR_CODES["CONFIGURATION_ERROR"],
                    status_code=401,
                )

            if response.status_code != 200:
                logger.error(
                    f"JDoodle API returned non-200 HTTP status: {response.status_code} - {response.text}"
                )
                raise AppBaseError(
                    message=f"JDoodle API request failed with status {response.status_code}.",
                    error_code=ERROR_CODES["EXECUTION_ERROR"],
                    status_code=502,
                )

            data = response.json()
            return self._parse_jdoodle_response(data)

        except httpx.TimeoutException:
            logger.error(f"JDoodle API request timed out after {self.timeout} seconds.")
            raise AITimeoutError(
                message=f"Code execution timed out after {self.timeout} seconds.",
                error_code=ERROR_CODES["TIMEOUT_ERROR"],
                status_code=408,
            )

        except httpx.RequestError as exc:
            logger.error(f"Network error communicating with JDoodle API: {exc}")
            raise AppBaseError(
                message="Failed to connect to JDoodle execution service.",
                error_code=ERROR_CODES["EXECUTION_ERROR"],
                status_code=502,
            )

        except (AppBaseError, ConfigurationError, ValidationError, AITimeoutError):
            raise

        except Exception as exc:
            logger.error(f"Unexpected error during JDoodle code execution: {exc}", exc_info=True)
            raise AppBaseError(
                message="An unexpected error occurred during code execution.",
                error_code=ERROR_CODES["INTERNAL_ERROR"],
                status_code=500,
            )

    # ── Private Helper: Response Parsing ─────────────────────────────────────

    @staticmethod
    def _parse_jdoodle_response(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parses raw JDoodle JSON output into standardized result payload.
        """
        status_code = data.get("statusCode", 200)
        output = data.get("output", "") or ""
        cmp_error = data.get("cmpError", "") or ""
        error_msg = data.get("error", "") or ""
        memory = str(data.get("memory", "0") or "0")
        cpu_time = str(data.get("cpuTime", "0") or "0")

        # Check for invalid credentials returned in JSON payload
        if status_code in (401, 403) or "Unauthorized" in str(error_msg):
            logger.error("JDoodle payload indicated unauthorized access.")
            raise ConfigurationError(
                message="Invalid JDoodle API credentials.",
                error_code=ERROR_CODES["CONFIGURATION_ERROR"],
                status_code=401,
            )

        compiler_errors = cmp_error.strip()
        runtime_errors = ""
        stdout = ""

        # Determine compilation vs runtime vs success
        is_cmp_failure = bool(compiler_errors) or "compilation error" in output.lower()
        is_runtime_failure = bool(error_msg) and not is_cmp_failure

        if is_cmp_failure:
            logger.info("JDoodle execution completed with compilation error.")
            if not compiler_errors:
                compiler_errors = output.strip()
            execution_success = False
        elif is_runtime_failure:
            logger.info("JDoodle execution completed with runtime error.")
            runtime_errors = error_msg.strip() or output.strip()
            execution_success = False
        elif status_code != 200:
            logger.info(f"JDoodle execution failed with status code {status_code}.")
            runtime_errors = output.strip() or error_msg.strip()
            execution_success = False
        else:
            logger.info(f"JDoodle execution success | CPU: {cpu_time}s | Memory: {memory}KB")
            stdout = output
            execution_success = True

        return {
            "output": output,
            "stdout": stdout,
            "compiler_errors": compiler_errors,
            "runtime_errors": runtime_errors,
            "memory": memory,
            "cpu_time": cpu_time,
            "execution_success": execution_success,
            "status_code": status_code,
        }
