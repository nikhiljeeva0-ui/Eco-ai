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
    """Response schema returned by /analysis-history."""

    id: int
    timestamp: datetime
    total_energy: float
    total_carbon: float
    prediction_next_month: float
    model_accuracy: float
    user_id: Optional[int] = None

    class Config:
        from_attributes = True  # was orm_mode in Pydantic v1


class CopilotInsights(BaseModel):
    """Backend-generated AI Copilot intelligence."""

    risk_level: str
    sustainability_score: int
    trend_analysis: str
    prediction_analysis: str
    spike_detection: str
    action_recommendation: str
    final_message: str


class AnalysisWithCopilotResponse(BaseModel):
    """Enriched response from /analyze-energy including copilot insights."""

    id: int
    timestamp: datetime
    total_energy: float
    total_carbon: float
    prediction_next_month: float
    model_accuracy: float
    sustainability_score: int
    copilot: CopilotInsights
    user_id: Optional[int] = None


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
