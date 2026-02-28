"""
EcoSphere Neural — FastAPI Backend
====================================
Production-ready multi-user SaaS API v4.0.0.
JWT authentication, energy analysis, ML prediction,
PDF sustainability reports, and PostgreSQL persistence.

Run with:
    uvicorn main:app --reload

Interactive docs:
    http://127.0.0.1:8000/docs
"""

import os
from io import BytesIO, StringIO
from typing import List

import pandas as pd
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user, hash_password, verify_password
from database import Base, engine, get_db
from ml_model import train_and_predict
from models import EnergyAnalysis, User
from schemas import (
    ChangePasswordRequest,
    EnergyAnalysisResponse,
    ProfileResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="EcoSphere Neural API",
    description="AI-Powered Climate Intelligence Engine — Pilot-Ready SaaS Backend",
    version="4.0.0",
)

# ---------------------------------------------------------------------------
# CORS — production-restricted
# ---------------------------------------------------------------------------

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:8080,https://eco-ai-1.onrender.com"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Carbon emission factor: kg CO₂ per kWh
CARBON_FACTOR = 0.82


# ---------------------------------------------------------------------------
# Global exception handler — clean JSON errors
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error. Please try again later."},
    )


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
    return {"status": "EcoSphere Neural Backend Running", "version": "4.0.0"}


# ---------------------------------------------------------------------------
# Authentication endpoints
# ---------------------------------------------------------------------------

@app.post("/register")
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.

    Accepts email and password. Returns success message.
    """
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered.",
        )

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

    return record


# ---------------------------------------------------------------------------
# Profile endpoints (protected)
# ---------------------------------------------------------------------------

@app.get("/profile", response_model=ProfileResponse)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the current user's profile information.

    **Requires authentication** — pass your JWT as a Bearer token.
    """
    analysis_count = (
        db.query(EnergyAnalysis)
        .filter(EnergyAnalysis.user_id == current_user.id)
        .count()
    )
    return ProfileResponse(
        email=current_user.email,
        created_at=current_user.created_at,
        analysis_count=analysis_count,
    )


@app.put("/change-password")
def change_password(
    req: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Change the current user's password.

    **Requires authentication** — pass your JWT as a Bearer token.
    """
    if not verify_password(req.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    current_user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password changed successfully."}


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


# ---------------------------------------------------------------------------
# PDF Sustainability Report (protected)
# ---------------------------------------------------------------------------

@app.get("/generate-report/{analysis_id}")
def generate_report(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a downloadable PDF sustainability report for a specific analysis.

    **Requires authentication** — pass your JWT as a Bearer token.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    # Fetch analysis record (must belong to current user)
    record = (
        db.query(EnergyAnalysis)
        .filter(EnergyAnalysis.id == analysis_id, EnergyAnalysis.user_id == current_user.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Analysis record not found.")

    # Calculate sustainability score
    sustainability_score = max(0, min(100, round(100 - (record.total_carbon / 200), 1)))

    # Emission level
    if record.total_carbon < 5000:
        emission_level = "Low Emission"
    elif record.total_carbon < 15000:
        emission_level = "Moderate Emission"
    else:
        emission_level = "High Emission"

    # AI Recommendations based on data
    recommendations = []
    if record.total_carbon > 15000:
        recommendations.append("High carbon footprint detected. Consider renewable energy sources.")
    elif record.total_carbon > 5000:
        recommendations.append("Moderate emissions. Optimize peak-hour energy consumption.")
    else:
        recommendations.append("Emissions within optimal range. Maintain current practices.")

    if record.prediction_next_month > record.total_energy / max(1, 12):
        recommendations.append("Rising energy trend predicted. Review HVAC and lighting schedules.")
    else:
        recommendations.append("Energy usage trending downward. Continue monitoring.")

    recommendations.append("Consider solar panel offset for peak consumption months.")

    # Build PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=50, bottomMargin=50)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CustomTitle", parent=styles["Title"],
        fontSize=24, textColor=colors.HexColor("#00b27a"),
        spaceAfter=8,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        fontSize=12, textColor=colors.grey, spaceAfter=30,
    )
    section_style = ParagraphStyle(
        "Section", parent=styles["Heading2"],
        fontSize=14, textColor=colors.HexColor("#1a1a2e"),
        spaceBefore=20, spaceAfter=10,
    )
    body_style = ParagraphStyle(
        "BodyText", parent=styles["Normal"],
        fontSize=11, textColor=colors.HexColor("#333333"),
        spaceBefore=4, spaceAfter=4, leading=16,
    )

    elements = []

    # Header
    elements.append(Paragraph("EcoSphere Neural", title_style))
    elements.append(Paragraph("AI-Powered Sustainability Report", subtitle_style))
    elements.append(Spacer(1, 6))

    # Campus info
    elements.append(Paragraph("Campus: Engineering Institution (Pilot)", body_style))
    elements.append(Paragraph(f"Prepared for: {current_user.email}", body_style))
    elements.append(Spacer(1, 12))

    # Info section
    elements.append(Paragraph("Analysis Summary", section_style))

    ts = record.timestamp.strftime("%B %d, %Y at %I:%M %p") if record.timestamp else "N/A"

    data = [
        ["Metric", "Value"],
        ["Report Date", ts],
        ["Campus", "Engineering Institution (Pilot)"],
        ["Total Energy Consumed", f"{record.total_energy:,.2f} kWh"],
        ["Carbon Emission", f"{record.total_carbon:,.2f} kg CO₂"],
        ["Next Month Prediction", f"{record.prediction_next_month:,.2f} kWh"],
        ["Model Accuracy (R²)", f"{record.model_accuracy * 100:.1f}%"],
        ["Sustainability Score", f"{sustainability_score} / 100"],
        ["Emission Level", emission_level],
        ["User", current_user.email],
    ]

    table = Table(data, colWidths=[220, 260])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#00b27a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 12),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f0fdf4")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("FONTSIZE", (0, 1), (-1, -1), 11),
        ("TOPPADDING", (0, 1), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 24))

    # AI Recommendations section
    elements.append(Paragraph("AI Recommendations", section_style))
    for i, rec in enumerate(recommendations, 1):
        elements.append(Paragraph(f"{i}. {rec}", body_style))
    elements.append(Spacer(1, 24))

    # Footer
    elements.append(Paragraph(
        "Generated by EcoSphere Neural AI Climate Intelligence Engine · Pilot Version 1.0",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=9, textColor=colors.grey),
    ))

    doc.build(elements)
    buffer.seek(0)

    filename = f"EcoSphere_Report_{analysis_id}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
