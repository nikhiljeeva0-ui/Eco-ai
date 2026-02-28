"""
EcoSphere Neural — ORM Models
==============================
SQLAlchemy table definitions for users and energy analyses.
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    """Registered platform user."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    analyses = relationship("EnergyAnalysis", back_populates="owner")

    def __repr__(self):
        return f"<User id={self.id} email={self.email}>"


class EnergyAnalysis(Base):
    """Stores the result of each energy CSV analysis."""

    __tablename__ = "energy_analyses"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    total_energy = Column(Float, nullable=False)
    total_carbon = Column(Float, nullable=False)
    prediction_next_month = Column(Float, nullable=False)
    model_accuracy = Column(Float, nullable=False)

    # Multi-user: nullable so existing records without a user are preserved
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    owner = relationship("User", back_populates="analyses")

    def __repr__(self):
        return (
            f"<EnergyAnalysis id={self.id} "
            f"energy={self.total_energy} carbon={self.total_carbon}>"
        )
