"""
copilot_engine.py — Backend-Powered AI Copilot Intelligence Engine
=================================================================
Structured rule-based intelligence for the EcoSphere Neural platform.
All copilot logic lives here. Frontend only displays the final message.

Future upgrade path:
  - Replace with ML anomaly detection
  - Integrate OpenAI / LLM
  - Add time-series forecasting
  - Add sustainability scoring model
"""

from typing import Any, Dict, List, Optional


def _classify_emission_risk(total_carbon: float) -> tuple:
    """Step 1 — Emission risk classification."""
    if total_carbon > 20000:
        return "High Risk", (
            "🔴 High Emission Risk detected. "
            f"Carbon output of {total_carbon:,.0f} kg CO₂ exceeds safe thresholds."
        )
    elif total_carbon > 10000:
        return "Moderate Risk", (
            "🟡 Moderate Emission Risk. "
            f"Carbon output of {total_carbon:,.0f} kg CO₂ requires optimization."
        )
    else:
        return "Low Risk", (
            "🟢 Low Emission Risk. "
            f"Carbon output of {total_carbon:,.0f} kg CO₂ is within optimal range."
        )


def _calculate_sustainability_score(total_carbon: float) -> int:
    """Step 2 — Sustainability score (0–100)."""
    return max(0, min(100, round(100 - (total_carbon / 200))))


def _analyze_trend(
    current_carbon: float,
    previous_carbon: Optional[float],
) -> str:
    """Step 3 — Trend comparison vs previous upload."""
    if previous_carbon is None or previous_carbon == 0:
        return "First analysis recorded. Future uploads will enable trend tracking."

    pct = ((current_carbon - previous_carbon) / previous_carbon) * 100

    if pct > 5:
        return (
            f"⬆ Carbon increased by {abs(pct):.1f}% compared to last upload. "
            "Review energy consumption patterns."
        )
    elif pct < -5:
        return (
            f"⬇ Carbon reduced by {abs(pct):.1f}% compared to last upload. "
            "Great progress on sustainability!"
        )
    else:
        return "↔ Carbon levels stable compared to previous upload."


def _analyze_prediction(
    prediction_next_month: float,
    total_energy: float,
    month_count: int,
) -> str:
    """Step 4 — Prediction analysis vs average monthly energy."""
    avg_monthly = total_energy / max(1, month_count)

    if prediction_next_month > avg_monthly * 1.05:
        diff_pct = ((prediction_next_month - avg_monthly) / avg_monthly) * 100
        return (
            f"📈 Projected increase of {diff_pct:.1f}% in energy usage next month. "
            "Consider reviewing HVAC and lighting schedules."
        )
    elif prediction_next_month < avg_monthly * 0.95:
        diff_pct = ((avg_monthly - prediction_next_month) / avg_monthly) * 100
        return (
            f"📉 Energy trend stabilizing — projected {diff_pct:.1f}% decrease. "
            "Continue monitoring."
        )
    else:
        return "📊 Next month's energy usage projected at similar levels. Stable trend."


def _detect_spikes(monthly_values: List[float]) -> str:
    """Step 5 — Spike detection (any month > 1.3× average)."""
    if not monthly_values or len(monthly_values) < 2:
        return ""

    avg = sum(monthly_values) / len(monthly_values)
    if avg == 0:
        return ""

    spikes = [i + 1 for i, v in enumerate(monthly_values) if v > avg * 1.3]

    if spikes:
        spike_months = ", ".join([f"Month {s}" for s in spikes[:5]])
        return (
            f"⚡ Energy spikes detected in: {spike_months}. "
            "Peak months may be driving up overall carbon output."
        )
    return "✓ No significant energy spikes detected."


def _generate_recommendations(risk_level: str, sustainability_score: int) -> str:
    """Step 6 — Action recommendations based on risk and score."""
    recs: List[str] = []

    if risk_level == "High Risk":
        recs.append("Integrate renewable energy sources (solar/wind) for peak loads.")
        recs.append("Optimize peak-hour consumption schedules.")
        recs.append("Conduct energy audit of high-consumption facilities.")
    elif risk_level == "Moderate Risk":
        recs.append("Implement load balancing across campus buildings.")
        recs.append("Optimize HVAC schedules during off-peak hours.")
        recs.append("Consider LED upgrades in high-usage areas.")
    else:
        recs.append("Maintain current efficiency practices.")
        recs.append("Monitor for seasonal variations.")
        if sustainability_score >= 80:
            recs.append("Excellent performance — consider sharing best practices.")

    return "💡 Recommendations: " + " | ".join(recs)


def generate_copilot_insights(
    current_analysis: Dict[str, Any],
    previous_analysis: Optional[Dict[str, Any]] = None,
    monthly_values: Optional[List[float]] = None,
) -> Dict[str, Any]:
    """
    Main copilot intelligence function.

    Args:
        current_analysis: dict with total_energy, total_carbon,
                          prediction_next_month, model_accuracy, month_count
        previous_analysis: dict with total_carbon (or None)
        monthly_values: list of monthly energy values for spike detection

    Returns:
        Dictionary with all copilot insights + final_message
    """
    total_carbon = current_analysis.get("total_carbon", 0)
    total_energy = current_analysis.get("total_energy", 0)
    prediction = current_analysis.get("prediction_next_month", 0)
    accuracy = current_analysis.get("model_accuracy", 0)
    month_count = current_analysis.get("month_count", 12)

    # Step 1 — Risk classification
    risk_level, risk_message = _classify_emission_risk(total_carbon)

    # Step 2 — Sustainability score
    sustainability_score = _calculate_sustainability_score(total_carbon)

    # Step 3 — Trend comparison
    prev_carbon = previous_analysis.get("total_carbon") if previous_analysis else None
    trend_analysis = _analyze_trend(total_carbon, prev_carbon)

    # Step 4 — Prediction analysis
    prediction_analysis = _analyze_prediction(prediction, total_energy, month_count)

    # Step 5 — Spike detection
    spike_detection = _detect_spikes(monthly_values or [])

    # Step 6 — Action recommendations
    action_recommendation = _generate_recommendations(risk_level, sustainability_score)

    # Step 7 — Final message composition
    parts = [risk_message, trend_analysis, prediction_analysis]
    if spike_detection:
        parts.append(spike_detection)
    parts.append(action_recommendation)

    final_message = " ".join(parts)

    return {
        "risk_level": risk_level,
        "sustainability_score": sustainability_score,
        "trend_analysis": trend_analysis,
        "prediction_analysis": prediction_analysis,
        "spike_detection": spike_detection,
        "action_recommendation": action_recommendation,
        "final_message": final_message,
    }
