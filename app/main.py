from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
from pandas.api.types import is_numeric_dtype
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "womensafety_updated.csv"
STATIC_DIR = Path(__file__).resolve().parent / "static"

RISK_ORDER = ["low", "medium", "high"]
RISK_COLORS = {"low": "#34d399", "medium": "#fbbf24", "high": "#fb7185"}

app = FastAPI(
    title="Women Safety Risk Intelligence API",
    description="FastAPI backend for Karachi women safety risk dashboard.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class PredictionInput(BaseModel):
    area_type: str = "market"
    time_of_day: str = "night"
    hour: int = Field(default=22, ge=0, le=23)
    day_of_week: str = "Friday"
    is_weekend: int = Field(default=0, ge=0, le=1)
    crime_type: str = "harassment"
    reported_incidents: int = Field(default=9, ge=0, le=50)
    lighting_condition: str = "poorly_lit"
    crowd_density: str = "medium"
    police_presence: str = "low"
    cctv_coverage: str = "no"
    proximity_to_police_station_km: float = Field(default=3.0, ge=0)
    population_density: str = "medium"
    transport_availability: str = "moderate"
    feel_unsafe_rating: int = Field(default=3, ge=1, le=5)
    weather: str = "clear"
    cctv_available: int = Field(default=0, ge=0, le=1)
    police_patrol: int = Field(default=0, ge=0, le=1)
    previous_incidents_Monthly: int = Field(default=8, ge=0, le=100)
    police_station_Distance_km: float = Field(default=2.5, ge=0)
    public_transport_Available: int = Field(default=1, ge=0, le=1)


@lru_cache(maxsize=1)
def load_data() -> pd.DataFrame:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["month"] = df["date"].dt.to_period("M").astype(str)
    df["year"] = df["date"].dt.year
    return df


def counts(series: pd.Series, order: list[str] | None = None) -> list[dict[str, Any]]:
    vc = series.value_counts()
    if order:
        vc = vc.reindex(order, fill_value=0)
    return [{"name": str(k), "value": int(v)} for k, v in vc.items()]


def grouped_counts(df: pd.DataFrame, group_col: str) -> dict[str, Any]:
    table = (
        df.groupby([group_col, "risk_level"])
        .size()
        .unstack(fill_value=0)
        .reindex(columns=RISK_ORDER, fill_value=0)
    )
    return {
        "labels": [str(x) for x in table.index.tolist()],
        "series": {risk: table[risk].astype(int).tolist() for risk in RISK_ORDER},
    }


@lru_cache(maxsize=1)
def get_model() -> Pipeline:
    df = load_data()
    feature_cols = [
        "area_type",
        "time_of_day",
        "hour",
        "day_of_week",
        "is_weekend",
        "crime_type",
        "reported_incidents",
        "lighting_condition",
        "crowd_density",
        "police_presence",
        "cctv_coverage",
        "proximity_to_police_station_km",
        "population_density",
        "transport_availability",
        "feel_unsafe_rating",
        "weather",
        "cctv_available",
        "police_patrol",
        "previous_incidents_Monthly",
        "police_station_Distance_km",
        "public_transport_Available",
    ]
    numeric = [c for c in feature_cols if is_numeric_dtype(df[c])]
    categorical = [c for c in feature_cols if c not in numeric]
    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical),
            ("num", StandardScaler(), numeric),
        ]
    )
    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=120,
                    max_depth=14,
                    min_samples_leaf=4,
                    random_state=42,
                    n_jobs=-1,
                    class_weight="balanced_subsample",
                ),
            ),
        ]
    )
    model.fit(df[feature_cols], df["risk_level"])
    return model


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/summary")
def summary() -> dict[str, Any]:
    df = load_data()
    high = int((df["risk_level"] == "high").sum())
    high_rate = round(high / len(df) * 100, 1)
    highest_area = (
        df.groupby("area_name")["risk_score"]
        .mean()
        .sort_values(ascending=False)
        .head(1)
        .index[0]
    )
    return {
        "records": int(len(df)),
        "areas": int(df["area_name"].nunique()),
        "date_range": {
            "start": df["date"].min().strftime("%b %d, %Y"),
            "end": df["date"].max().strftime("%b %d, %Y"),
        },
        "avg_risk_score": round(float(df["risk_score"].mean()), 3),
        "high_risk_rate": high_rate,
        "highest_risk_area": highest_area,
        "risk_counts": counts(df["risk_level"], RISK_ORDER),
        "top_crimes": counts(df["crime_type"])[:8],
        "area_types": counts(df["area_type"]),
    }


@app.get("/api/charts")
def charts() -> dict[str, Any]:
    df = load_data()
    monthly = (
        df.groupby(["month", "risk_level"])
        .size()
        .unstack(fill_value=0)
        .reindex(columns=RISK_ORDER, fill_value=0)
        .tail(24)
    )
    hourly = (
        df.groupby(["hour", "risk_level"])
        .size()
        .unstack(fill_value=0)
        .reindex(columns=RISK_ORDER, fill_value=0)
        .reindex(range(24), fill_value=0)
    )
    weather = (
        df.groupby("weather")["risk_score"]
        .mean()
        .sort_values(ascending=False)
        .round(3)
    )
    corridors = (
        df.groupby("area_name")
        .agg(
            risk_score=("risk_score", "mean"),
            incidents=("reported_incidents", "sum"),
            high_risk=("risk_level", lambda s: int((s == "high").sum())),
            latitude=("latitude", "mean"),
            longitude=("longitude", "mean"),
        )
        .sort_values(["risk_score", "high_risk"], ascending=False)
        .head(12)
        .reset_index()
    )
    return {
        "risk_by_time": grouped_counts(df, "time_of_day"),
        "risk_by_area_type": grouped_counts(df, "area_type"),
        "risk_by_lighting": grouped_counts(df, "lighting_condition"),
        "risk_by_police": grouped_counts(df, "police_presence"),
        "monthly": {
            "labels": monthly.index.tolist(),
            "series": {risk: monthly[risk].astype(int).tolist() for risk in RISK_ORDER},
        },
        "hourly": {
            "labels": [str(x) for x in hourly.index.tolist()],
            "series": {risk: hourly[risk].astype(int).tolist() for risk in RISK_ORDER},
        },
        "weather_score": {
            "labels": weather.index.tolist(),
            "values": weather.tolist(),
        },
        "top_corridors": corridors.round(4).to_dict(orient="records"),
    }


@app.get("/api/map")
def map_points(limit: int = 1600) -> dict[str, Any]:
    df = load_data()
    limit = max(100, min(limit, 5000))
    sample = df.sort_values("risk_score", ascending=False).head(limit)
    area_summary = (
        df.groupby(["area_name", "area_type"])
        .agg(
            latitude=("latitude", "mean"),
            longitude=("longitude", "mean"),
            risk_score=("risk_score", "mean"),
            incidents=("reported_incidents", "sum"),
            high_risk=("risk_level", lambda s: int((s == "high").sum())),
        )
        .reset_index()
        .sort_values("risk_score", ascending=False)
    )
    return {
        "center": [round(float(df["latitude"].mean()), 5), round(float(df["longitude"].mean()), 5)],
        "points": sample[
            ["area_name", "area_type", "latitude", "longitude", "risk_level", "risk_score", "crime_type"]
        ].round(5).to_dict(orient="records"),
        "areas": area_summary.round(5).to_dict(orient="records"),
        "colors": RISK_COLORS,
    }


@app.get("/api/options")
def options() -> dict[str, list[Any]]:
    df = load_data()
    option_cols = [
        "area_type",
        "time_of_day",
        "day_of_week",
        "crime_type",
        "lighting_condition",
        "crowd_density",
        "police_presence",
        "cctv_coverage",
        "population_density",
        "transport_availability",
        "weather",
    ]
    return {col: sorted(df[col].dropna().unique().tolist()) for col in option_cols}


@app.post("/api/predict")
def predict(payload: PredictionInput) -> dict[str, Any]:
    try:
        model = get_model()
        row = pd.DataFrame([payload.model_dump()])
        prediction = str(model.predict(row)[0])
        probabilities = model.predict_proba(row)[0]
        classes = model.named_steps["classifier"].classes_
        probability_map = {
            str(cls): round(float(prob), 3) for cls, prob in zip(classes, probabilities)
        }
        confidence = probability_map.get(prediction, max(probability_map.values()))
        return {
            "risk_level": prediction,
            "confidence": confidence,
            "probabilities": probability_map,
            "color": RISK_COLORS.get(prediction, "#ffffff"),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
