"""
Future Models & Extension Schemas.

Defines Pydantic models for future Version 2.0+ entities (User, Project,
UserSettings, SavedReview) as specified in docs/09-Database.md & docs/11-Future-Expansion-Roadmap.md.

These models serve as architectural blueprints ensuring backward compatibility
for future database migrations.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    """Base user attributes."""

    email: str = Field(..., description="User primary email address.")
    name: Optional[str] = Field(None, description="User full name.")


class UserCreate(UserBase):
    """Request model for POST /api/v1/auth/register."""

    password: str = Field(..., min_length=8, description="User raw password.")


class UserResponse(UserBase):
    """Response model for authenticated user profile."""

    id: str = Field(..., description="User unique UUID.")
    created_at: str = Field(..., description="Account creation timestamp.")


class ProjectModel(BaseModel):
    """Project entity model for grouping code reviews."""

    id: str = Field(..., description="Project unique UUID.")
    user_id: str = Field(..., description="Owner user UUID.")
    name: str = Field(..., description="Project name.")
    description: Optional[str] = Field(None, description="Project description.")
    created_at: str = Field(..., description="Creation timestamp.")


class UserSettingsModel(BaseModel):
    """User settings and UI preferences model."""

    user_id: str = Field(..., description="Owner user UUID.")
    theme: str = Field(default="dark", description="UI theme ('dark' or 'light').")
    preferred_language: str = Field(default="python", description="Default programming language.")
    default_review_focus: str = Field(default="general", description="Default review focus area.")


class SavedReviewModel(BaseModel):
    """Persistent code review record model."""

    id: str = Field(..., description="Review unique UUID.")
    project_id: Optional[str] = Field(None, description="Associated project UUID.")
    language: str = Field(..., description="Programming language.")
    review_focus: str = Field(..., description="Review focus area.")
    review_markdown: str = Field(..., description="Generated Markdown review.")
    rewritten_code: Optional[str] = Field(None, description="Associated rewritten code.")
    created_at: str = Field(..., description="Creation timestamp.")
