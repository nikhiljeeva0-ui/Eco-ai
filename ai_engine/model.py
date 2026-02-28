"""
EcoSphere Neural — AI Energy Prediction Engine
================================================
A production-ready Linear Regression model that predicts
next month's energy consumption based on historical data.

Usage:
    python model.py

This module is designed for easy integration into a FastAPI
backend as a prediction service endpoint.
"""

import os
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score


# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------

def load_data(filepath: str) -> pd.DataFrame:
    """Load energy usage CSV and return a clean DataFrame."""
    df = pd.read_csv(filepath)

    # Map month names to numeric indices (1-12)
    month_map = {
        "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4,
        "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
        "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
    }
    df["Month_Num"] = df["Date"].map(month_map)

    # Drop rows where the month couldn't be mapped
    df.dropna(subset=["Month_Num"], inplace=True)
    df["Month_Num"] = df["Month_Num"].astype(int)

    return df


# ---------------------------------------------------------------------------
# Model Training
# ---------------------------------------------------------------------------

def train_model(df: pd.DataFrame) -> tuple[LinearRegression, float]:
    """
    Train a LinearRegression model on the energy data.

    Returns:
        model   — the trained sklearn model
        r2      — R² accuracy score on training data
    """
    # Feature matrix (month number) and target vector (energy kWh)
    X = df[["Month_Num"]].values          # shape (n, 1)
    y = df["Energy_kWh"].values           # shape (n,)

    model = LinearRegression()
    model.fit(X, y)

    # Evaluate on training data
    y_pred = model.predict(X)
    r2 = r2_score(y, y_pred)

    return model, r2


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

def predict_next_month(model: LinearRegression, current_month_count: int) -> float:
    """
    Predict energy usage for the next month.

    Args:
        model               — trained LinearRegression model
        current_month_count — number of months of data already seen
                              (e.g. 12 means next prediction is month 13)

    Returns:
        Predicted energy consumption in kWh.
    """
    next_month = np.array([[current_month_count + 1]])
    prediction = model.predict(next_month)[0]
    return round(prediction, 2)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    """Entry-point: load data ➜ train ➜ predict ➜ print results."""

    # Resolve CSV path relative to this script
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "energy.csv")

    # 1. Load data
    print("Loading energy data...")
    df = load_data(csv_path)
    print(f"  ✓ {len(df)} months loaded\n")

    # 2. Train model
    print("Training Linear Regression model...")
    model, r2 = train_model(df)
    print(f"  ✓ Model trained\n")

    # 3. Predict next month
    next_month_num = len(df)  # e.g. 12 → predict month 13
    prediction = predict_next_month(model, next_month_num)

    # 4. Display results
    print("=" * 45)
    print(f"  Predicted Next Month Energy Usage: {prediction} kWh")
    print(f"  Model Accuracy (R² Score):         {r2:.4f}")
    print("=" * 45)


if __name__ == "__main__":
    main()
