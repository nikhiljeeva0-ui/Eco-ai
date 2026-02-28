"""
EcoSphere Neural — FastAPI Backend
====================================
Production-ready multi-user API with JWT authentication.
Accepts energy CSV uploads, calculates carbon emissions,
returns AI predictions, and persists results per user
in PostgreSQL.

Run with:
    uvicorn main:app --reload

Interactive docs:
    http://127.0.0.1:8000/docs
"""

from io import StringIO
from typing import List

import pandas as pd
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user, hash_password, verify_password
from database import Base, engine, get_db
from ml_model import train_and_predict
from models import EnergyAnalysis, User
from schemas import (
    EnergyAnalysisResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="EcoSphere Neural API",
    description="AI-Powered Climate Intelligence Engine — Multi-User SaaS Backend",
    version="3.0.0",
)

# Allow frontend to call this API from any origin during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Carbon emission factor: kg CO₂ per kWh
CARBON_FACTOR = 0.82


# ---------------------------------------------------------------------------
# Database initialization
# ---------------------------------------------------------------------------

@app.on_event("startup")
def on_startup():
    """Create all tables on application startup."""
    Base.metadata.create_all(bind=engine)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/")
def health_check():
    """Health-check endpoint — confirms the backend is running."""
    return {"status": "EcoSphere Neural Backend Running", "version": "3.0.0"}


# ---------------------------------------------------------------------------
# Authentication endpoints
# ---------------------------------------------------------------------------

@app.post("/register")
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.

    Accepts email and password. Returns success message.
    """
    # Check if email already exists
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered.",
        )

    # Create user with hashed password
    new_user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User registered successfully", "email": new_user.email}


@app.post("/login", response_model=TokenResponse)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate and receive a JWT token.

    Use the token in the Authorization header: `Bearer <token>`
    """
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    token = create_access_token(data={"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# Energy analysis endpoints (protected)
# ---------------------------------------------------------------------------

@app.post("/analyze-energy", response_model=EnergyAnalysisResponse)
async def analyze_energy(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an energy CSV and receive analysis + AI prediction.

    **Requires authentication** — pass your JWT as a Bearer token.

    The CSV must contain an **Energy_kWh** column.
    Rows should be in chronological order (one per month).

    Results are saved to the database linked to your account.
    """
    # --- Read the uploaded file -----------------------------------------
    try:
        contents = await file.read()
        text = contents.decode("utf-8")
        df = pd.read_csv(StringIO(text))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not parse the uploaded file. Please upload a valid CSV.",
        )

    # --- Validate required column ---------------------------------------
    if "Energy_kWh" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="Invalid CSV format. Energy_kWh column required.",
        )

    # --- Calculations ---------------------------------------------------
    total_energy = round(float(df["Energy_kWh"].sum()), 2)
    total_carbon = round(total_energy * CARBON_FACTOR, 2)

    # --- ML Prediction --------------------------------------------------
    ml_result = train_and_predict(df)

    # --- Persist to database --------------------------------------------
    try:
        record = EnergyAnalysis(
            total_energy=total_energy,
            total_carbon=total_carbon,
            prediction_next_month=ml_result["prediction"],
            model_accuracy=ml_result["r2_score"],
            user_id=current_user.id,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database error: could not save analysis. {exc}",
        )

    # --- Response -------------------------------------------------------
    return record


@app.get("/analysis-history", response_model=List[EnergyAnalysisResponse])
def analysis_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve the last 10 energy analyses for your account, newest first.

    **Requires authentication** — pass your JWT as a Bearer token.
    """
    try:
        records = (
            db.query(EnergyAnalysis)
            .filter(EnergyAnalysis.user_id == current_user.id)
            .order_by(EnergyAnalysis.timestamp.desc())
            .limit(10)
            .all()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: could not retrieve history. {exc}",
        )
    return records
