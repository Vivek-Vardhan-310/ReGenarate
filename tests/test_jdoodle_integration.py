"""
Unit & Integration Tests for JDoodle Compiler API Integration.

Verifies:
1. JDoodleService credential validation and configuration checks.
2. Language mapping resolution for supported frontend languages.
3. Execution response parsing (stdout, compiler errors, runtime errors, status code).
4. Error handling for network timeouts, invalid credentials, and unsupported languages.
5. FastAPI /api/v1/run and /api/v1/execute endpoints.
6. Integration of JDoodle execution results in AI review prompt.
"""

from unittest.mock import AsyncMock, patch
import pytest
import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.config.constants import JDOODLE_LANGUAGE_MAPPING
from app.config.settings import settings
from app.schemas.requests import ReviewRequest, RunCodeRequest
from app.services.jdoodle import JDoodleService
from app.services.review_service import ReviewService
from app.utils.exceptions import (
    AITimeoutError,
    AppBaseError,
    ConfigurationError,
    ValidationError,
)

client = TestClient(app)


def test_language_mapping_completeness():
    """Verify all major languages are present in JDOODLE_LANGUAGE_MAPPING."""
    required_langs = ["python", "cpp", "c", "java", "javascript", "typescript", "go", "rust"]
    for lang in required_langs:
        assert lang in JDOODLE_LANGUAGE_MAPPING
        assert "language" in JDOODLE_LANGUAGE_MAPPING[lang]
        assert "versionIndex" in JDOODLE_LANGUAGE_MAPPING[lang]


def test_jdoodle_service_is_configured_check():
    """Verify JDoodleService correctly detects presence of credentials."""
    service_unconfigured = JDoodleService(client_id="", client_secret="")
    assert service_unconfigured.is_configured() is False

    service_configured = JDoodleService(client_id="test_id", client_secret="test_secret")
    assert service_configured.is_configured() is True


@pytest.mark.anyio
async def test_execute_code_unconfigured_raises_configuration_error():
    """Verify execute_code raises ConfigurationError when client credentials are blank."""
    service = JDoodleService(client_id="", client_secret="")
    with pytest.raises(ConfigurationError) as exc_info:
        await service.execute_code(code="print(1)", language="python")
    assert "not configured" in str(exc_info.value)


@pytest.mark.anyio
async def test_execute_code_unsupported_language_raises_validation_error():
    """Verify execute_code raises ValidationError for unsupported execution target."""
    service = JDoodleService(client_id="id", client_secret="secret")
    with pytest.raises(ValidationError) as exc_info:
        await service.execute_code(code="<h1>Hello</h1>", language="html")
    assert "not supported" in str(exc_info.value)


@pytest.mark.anyio
async def test_execute_code_success_parsing():
    """Verify JDoodleService correctly parses a successful execution response."""
    mock_jdoodle_json = {
        "output": "Hello World\n",
        "statusCode": 200,
        "memory": "28168",
        "cpuTime": "0.01",
        "cmpError": "",
        "error": None,
    }

    mock_response = httpx.Response(status_code=200, json=mock_jdoodle_json)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        service = JDoodleService(client_id="test_id", client_secret="test_secret")
        result = await service.execute_code(code="print('Hello World')", language="python")

        assert result["execution_success"] is True
        assert result["output"] == "Hello World\n"
        assert result["stdout"] == "Hello World\n"
        assert result["compiler_errors"] == ""
        assert result["runtime_errors"] == ""
        assert result["memory"] == "28168"
        assert result["cpu_time"] == "0.01"
        assert result["status_code"] == 200


@pytest.mark.anyio
async def test_execute_code_compilation_error_parsing():
    """Verify JDoodleService correctly captures compilation errors."""
    mock_jdoodle_json = {
        "output": "main.cpp: In function 'int main()': error: expected ';' before 'return'",
        "statusCode": 200,
        "memory": "0",
        "cpuTime": "0",
        "cmpError": "main.cpp: error: expected ';' before 'return'",
        "error": None,
    }

    mock_response = httpx.Response(status_code=200, json=mock_jdoodle_json)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        service = JDoodleService(client_id="test_id", client_secret="test_secret")
        result = await service.execute_code(code="int main() { return 0 }", language="cpp")

        assert result["execution_success"] is False
        assert "expected ';'" in result["compiler_errors"]
        assert result["stdout"] == ""


@pytest.mark.anyio
async def test_execute_code_timeout_handling():
    """Verify JDoodleService raises AITimeoutError on httpx TimeoutException."""
    with patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("Timed out")):
        service = JDoodleService(client_id="test_id", client_secret="test_secret")
        with pytest.raises(AITimeoutError):
            await service.execute_code(code="while True: pass", language="python")


@pytest.mark.anyio
async def test_execute_code_invalid_credentials_handling():
    """Verify JDoodleService handles 401 Unauthorized status code."""
    mock_response = httpx.Response(status_code=401, json={"error": "Unauthorized Access", "statusCode": 401})

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        service = JDoodleService(client_id="bad_id", client_secret="bad_secret")
        with pytest.raises(ConfigurationError) as exc_info:
            await service.execute_code(code="print(1)", language="python")
        assert "Invalid JDoodle API credentials" in str(exc_info.value)


def test_api_run_code_endpoint_success():
    """Test POST /api/v1/run endpoint returns successful execution data."""
    mock_exec_result = {
        "output": "42\n",
        "stdout": "42\n",
        "compiler_errors": "",
        "runtime_errors": "",
        "memory": "1000",
        "cpu_time": "0.02",
        "execution_success": True,
        "status_code": 200,
    }

    with patch.object(JDoodleService, "execute_code", new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = mock_exec_result
        with patch.object(JDoodleService, "is_configured", return_value=True):
            response = client.post(
                "/api/v1/run",
                json={"language": "python", "code": "print(42)"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["data"]["output"] == "42\n"
            assert data["data"]["execution_success"] is True


def test_api_execute_alias_endpoint():
    """Test POST /api/v1/execute alias endpoint returns 200 OK."""
    mock_exec_result = {
        "output": "Hello\n",
        "stdout": "Hello\n",
        "compiler_errors": "",
        "runtime_errors": "",
        "memory": "1000",
        "cpu_time": "0.01",
        "execution_success": True,
        "status_code": 200,
    }

    with patch.object(JDoodleService, "execute_code", new_callable=AsyncMock) as mock_execute:
        mock_execute.return_value = mock_exec_result
        response = client.post(
            "/api/v1/execute",
            json={"language": "python", "code": "print('Hello')"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


@pytest.mark.anyio
async def test_review_service_auto_executes_via_jdoodle():
    """Test ReviewService auto-executes code via JDoodle before passing to Groq prompt."""
    mock_exec = {
        "output": "ZeroDivisionError: division by zero",
        "stdout": "",
        "compiler_errors": "",
        "runtime_errors": "ZeroDivisionError: division by zero",
        "memory": "500",
        "cpu_time": "0.01",
        "execution_success": False,
        "status_code": 200,
    }

    mock_jdoodle = AsyncMock(spec=JDoodleService)
    mock_jdoodle.is_configured.return_value = True
    mock_jdoodle.execute_code.return_value = mock_exec

    review_service = ReviewService(jdoodle_service=mock_jdoodle)
    request = ReviewRequest(
        language="python",
        review_focus="general",
        code="print(1/0)",
    )

    response = await review_service.generate_review(request)
    assert response.success is True
    assert request.execution is not None
    assert request.execution.status == "failed"
    assert "ZeroDivisionError" in request.execution.stderr
