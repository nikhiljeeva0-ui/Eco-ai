"""
EcoSphere Neural — ML Model Module
====================================
Pure prediction logic with no side effects.
Accepts a DataFrame, trains a model, returns results.
Designed for import by the FastAPI application.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score


def train_and_predict(df: pd.DataFrame) -> dict:
    """
    Train a Linear Regression model on energy data and predict next month.

    Args:
        df: DataFrame with at least an 'Energy_kWh' column.
            Rows are assumed to be in chronological order.

    Returns:
        dict with keys:
            prediction  — predicted kWh for the next month
            r2_score    — R² accuracy of the model on training data
    """
    # Create a numeric month index (1, 2, 3, …)
    df = df.reset_index(drop=True)
    df["Month_Num"] = df.index + 1

    # Feature matrix and target vector
    X = df[["Month_Num"]].values   # shape (n, 1)
    y = df["Energy_kWh"].values    # shape (n,)

    # Train
    model = LinearRegression()
    model.fit(X, y)

    # Accuracy on training data
    y_pred = model.predict(X)
    accuracy = float(r2_score(y, y_pred))

    # Predict next month
    next_month = np.array([[len(df) + 1]])
    prediction = float(model.predict(next_month)[0])

    return {
        "prediction": round(prediction, 2),
        "r2_score": round(accuracy, 4),
    }
