"""
NOC Agentic — Forecasting Service (FastAPI + llmtime)
Exposes POST /forecast for probabilistic traffic forecasting.
"""

import os
import sys
import logging
from typing import List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Try to import llmtime. If not installed, we use a statistical fallback
# (exponential smoothing) so the service still works during dev.
# ---------------------------------------------------------------------------
try:
    import llmtime
    from llmtime.models.utils import get_model_predictions

    LLMTIME_AVAILABLE = True
except ImportError:
    LLMTIME_AVAILABLE = False
    logging.warning(
        "llmtime not installed — using statistical fallback (exponential smoothing)"
    )

app = FastAPI(title="NOC Forecasting Service", version="0.1.0")

# CORS — allow Vercel and localhost origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.environ.get("FORECAST_API_KEY", "")


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class ForecastRequest(BaseModel):
    site_id: str
    dates: List[str]
    traffic_gb: List[float]
    horizon: int = 14
    samples: int = 20


class ForecastResponse(BaseModel):
    site_id: str
    forecast_dates: List[str]
    p10: List[float]
    p50: List[float]
    p90: List[float]
    samples: Optional[List[List[float]]] = None


# ---------------------------------------------------------------------------
# Statistical fallback: simple exponential smoothing + bootstrap
# ---------------------------------------------------------------------------
def _statistical_forecast(
    traffic: List[float], horizon: int, n_samples: int
) -> np.ndarray:
    """Generate forecast samples using exponential smoothing + noise."""
    arr = np.array(traffic, dtype=float)
    alpha = 0.3
    level = arr[-1]
    trend = np.mean(np.diff(arr[-14:])) if len(arr) >= 15 else 0.0
    residuals = np.diff(arr)
    std = np.std(residuals) if len(residuals) > 1 else arr.std() * 0.05

    samples = np.zeros((n_samples, horizon))
    for s in range(n_samples):
        current = level
        for h in range(horizon):
            noise = np.random.normal(0, std)
            current = current + trend + noise
            samples[s, h] = max(current, 0)
    return samples


def _generate_forecast_dates(last_date: str, horizon: int) -> List[str]:
    """Generate ISO date strings starting the day after last_date."""
    from datetime import datetime, timedelta

    last = datetime.strptime(last_date, "%Y-%m-%d")
    return [(last + timedelta(days=i + 1)).strftime("%Y-%m-%d") for i in range(horizon)]


# ---------------------------------------------------------------------------
# Forecast endpoint
# ---------------------------------------------------------------------------
@app.post("/forecast", response_model=ForecastResponse, dependencies=[Depends(verify_api_key)])
async def forecast(req: ForecastRequest):
    if len(req.dates) != len(req.traffic_gb):
        raise HTTPException(400, "dates and traffic_gb must have the same length")
    if len(req.traffic_gb) < 7:
        raise HTTPException(400, "Need at least 7 data points for forecasting")

    forecast_dates = _generate_forecast_dates(req.dates[-1], req.horizon)

    if LLMTIME_AVAILABLE:
        try:
            # Use llmtime for forecasting
            predictions = get_model_predictions(
                train=np.array(req.traffic_gb),
                horizon=req.horizon,
                num_samples=req.samples,
            )
            sample_matrix = np.array(predictions["samples"])
        except Exception as e:
            logging.error(f"llmtime failed for {req.site_id}: {e}, falling back to stats")
            sample_matrix = _statistical_forecast(
                req.traffic_gb, req.horizon, req.samples
            )
    else:
        sample_matrix = _statistical_forecast(
            req.traffic_gb, req.horizon, req.samples
        )

    p10 = np.percentile(sample_matrix, 10, axis=0).tolist()
    p50 = np.percentile(sample_matrix, 50, axis=0).tolist()
    p90 = np.percentile(sample_matrix, 90, axis=0).tolist()

    return ForecastResponse(
        site_id=req.site_id,
        forecast_dates=forecast_dates,
        p10=[round(v, 1) for v in p10],
        p50=[round(v, 1) for v in p50],
        p90=[round(v, 1) for v in p90],
        samples=[row.tolist() for row in sample_matrix],
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "llmtime_available": LLMTIME_AVAILABLE,
    }
