"""
EcoSphere Neural — Pydantic Schemas
====================================
Request/response models for API serialization.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    """Registration request body."""
    email: str
    password: str


class UserLogin(BaseModel):
    """Login request body."""
    email: str
    password: str


class TokenResponse(BaseModel):
    """Returned after successful login."""
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Energy analysis schemas
# ---------------------------------------------------------------------------

class EnergyAnalysisResponse(BaseModel):
    """Response schema returned by /analyze-energy and /analysis-history."""

    id: int
    timestamp: datetime
    total_energy: float
    total_carbon: float
    prediction_next_month: float
    model_accuracy: float
    user_id: Optional[int] = None

    class Config:
        from_attributes = True  # was orm_mode in Pydantic v1


# ---------------------------------------------------------------------------
# Profile schemas
# ---------------------------------------------------------------------------

class ProfileResponse(BaseModel):
    """User profile information."""
    email: str
    created_at: datetime
    analysis_count: int


class ChangePasswordRequest(BaseModel):
    """Change password request body."""
    old_password: str
    new_password: str
