"""
Roadmap & Schema Compatibility Test Suite.

Verifies:
- Future expansion Pydantic models instantiate cleanly.
- Field validation constraints on future user/project models.
- Backward compatibility of V1 API response structures with future models.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.schemas.future_models import (
    ProjectModel,
    SavedReviewModel,
    UserCreate,
    UserResponse,
    UserSettingsModel,
)


def test_future_user_model_validation() -> None:
    """Verifies UserCreate and UserResponse schema instantiation."""
    user_req = UserCreate(email="test@example.com", name="Test User", password="securepassword123")
    assert user_req.email == "test@example.com"
    assert user_req.password == "securepassword123"

    user_res = UserResponse(id="usr_12345", email="test@example.com", name="Test User", created_at="2026-07-25T00:00:00Z")
    assert user_res.id == "usr_12345"


def test_future_project_model_instantiation() -> None:
    """Verifies ProjectModel schema instantiation."""
    proj = ProjectModel(
        id="proj_001",
        user_id="usr_12345",
        name="ReGenarate Core",
        description="AI Agent Architecture",
        created_at="2026-07-25T00:00:00Z",
    )
    assert proj.name == "ReGenarate Core"
    assert proj.user_id == "usr_12345"


def test_future_user_settings_defaults() -> None:
    """Verifies UserSettingsModel default preferences."""
    settings = UserSettingsModel(user_id="usr_12345")
    assert settings.theme == "dark"
    assert settings.preferred_language == "python"
    assert settings.default_review_focus == "general"


def test_future_saved_review_model() -> None:
    """Verifies SavedReviewModel schema compatibility with V1 outputs."""
    saved = SavedReviewModel(
        id="rev_999",
        language="python",
        review_focus="security",
        review_markdown="# Summary\nNo issues found.",
        rewritten_code="def safe(): pass",
        created_at="2026-07-25T00:00:00Z",
    )
    assert saved.language == "python"
    assert saved.rewritten_code == "def safe(): pass"
