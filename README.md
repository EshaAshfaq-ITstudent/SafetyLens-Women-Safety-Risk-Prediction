# Safety Lens: Women Safety Risk Prediction

<p align="center">
  <img src="app/static/assets/logo.png" alt="Safety Lens logo" width="120" />
</p>

<h3 align="center">A data-driven women safety intelligence platform for Karachi</h3>

<p align="center">
  Safety Lens combines machine learning, geospatial analytics, EDA dashboards, and a modern React interface to help identify unsafe areas, understand city-level risk patterns, and predict trip risk under real-world conditions.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-API-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge&logo=react&logoColor=111827" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-UI-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/scikit--learn-ML-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white" alt="scikit-learn" />
</p>

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Dataset](#dataset)
- [Machine Learning Pipeline](#machine-learning-pipeline)
- [Project Structure](#project-structure)
- [How to Run](#how-to-run)
- [API Endpoints](#api-endpoints)
- [EDA Notebook](#eda-notebook)
- [Future Improvements](#future-improvements)

---

## Project Overview

Women safety is a serious urban challenge, especially in high-density cities where risk changes by area, time, crowd level, lighting, transport access, and police visibility. This project converts those signals into an interactive safety intelligence system.

The platform uses a Karachi women safety dataset to:

- predict **Low**, **Medium**, or **High** risk for a selected scenario;
- visualize city hotspots on an interactive map;
- analyze risk by time, area type, lighting, weather, police presence, and crime category;
- provide a React dashboard for safer route exploration and community reporting;
- expose a FastAPI backend for live summaries, charts, maps, area lookup, and predictions.

---

## Key Features

### Risk Prediction

- Random Forest classifier trained on safety, crime, environment, and transport features.
- Predicts risk level from user-selected trip conditions.
- Returns model confidence and probability distribution for each risk class.

### Interactive Dashboard

- KPI tiles for total records, tracked areas, average risk score, and high-risk share.
- Risk distribution charts and crime frequency visualizations.
- Area-type comparison with Low, Medium, and High risk segmentation.

### Hotspot Mapping

- Leaflet-powered map for Karachi risk points.
- Hotspots colored by risk intensity.
- Top risk corridors ranked by average risk score and incident volume.

### Safe Route Experience

- React route planning interface.
- Known Karachi locations and autocomplete-based location handling.
- Community markers for reported unsafe locations.

### Community Safety Tools

- Unsafe-area reporting flow.
- SOS panel component.
- Voice assistant component.
- Light/dark theme support.

---

## Screenshots

Add your screenshots in a folder such as `docs/screenshots/` and then paste them here using the names below.

Recommended screenshot set:

| Section | Suggested file name |
| --- | --- |
| EDA dashboard overview | `docs/screenshots/eda-overview.png` |
| Risk distribution dashboard | `docs/screenshots/risk-distribution.png` |
| React home dashboard | `docs/screenshots/frontend-home.png` |
| Hotspot map | `docs/screenshots/hotspot-map.png` |
| Prediction form | `docs/screenshots/predictor.png` |
| Safe route planner | `docs/screenshots/routes.png` |

Example after adding images:

```md
![React Dashboard](docs/screenshots/frontend-home.png)
![Hotspot Map](docs/screenshots/hotspot-map.png)
![Risk Predictor](docs/screenshots/predictor.png)
```

---

## Tech Stack

### Backend and ML

- **Python**
- **FastAPI**
- **Pandas**
- **scikit-learn**
- **Uvicorn**
- **Pydantic**

### Frontend

- **React 19**
- **TypeScript**
- **Vite**
- **TanStack Router**
- **TanStack Query**
- **Recharts**
- **Leaflet / React Leaflet**
- **Framer Motion**
- **Tailwind CSS**
- **Lucide React icons**

### Data and Analysis

- **CSV dataset:** `womensafety_updated.csv`
- **EDA notebook:** `fullproject.ipynb`

---

## Dataset

The dataset contains incident and environment-level safety features for Karachi, including:

- area name and area type;
- latitude and longitude;
- date, hour, day of week, and time of day;
- crime type and reported incidents;
- lighting condition and crowd density;
- police presence and CCTV coverage;
- distance from police station;
- transport availability;
- weather;
- unsafe feeling rating;
- final risk level and risk score.

Main target column:

```text
risk_level
```

Risk classes:

```text
low | medium | high
```

---

## Machine Learning Pipeline

The backend trains the model inside `app/main.py`.

Pipeline flow:

1. Load `womensafety_updated.csv`.
2. Convert date fields and generate month/year features for analytics.
3. Split features into categorical and numeric columns.
4. Apply:
   - `OneHotEncoder` for categorical features;
   - `StandardScaler` for numeric features.
5. Train a `RandomForestClassifier`.
6. Serve predictions through `/api/predict`.

Model configuration:

```text
Classifier: RandomForestClassifier
Trees: 120
Max depth: 14
Class weighting: balanced_subsample
Random state: 42
```

---

## Project Structure

```text
Women-safety-prediction/
├── app/
│   ├── main.py                  # FastAPI backend and ML model
│   └── static/                  # Static HTML/CSS/JS dashboard assets
├── safe-path-guide/
│   ├── src/
│   │   ├── components/safety/   # React safety UI components
│   │   ├── lib/                 # API client, mock data, utilities
│   │   └── routes/              # App pages: map, predict, trends, routes, etc.
│   ├── package.json
│   └── vite.config.ts
├── fullproject.ipynb            # EDA and analysis notebook
├── womensafety_updated.csv      # Dataset
└── README.md
```

---

## How to Run

You can run the backend API and the React frontend separately.

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/<your-repo-name>.git
cd Women-safety-prediction
```

### 2. Run the FastAPI Backend

Create and activate a virtual environment:

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install backend dependencies:

```bash
pip install fastapi uvicorn pandas scikit-learn
```

Start the API:

```bash
uvicorn app.main:app --reload
```

Backend will run at:

```text
http://127.0.0.1:8000
```

FastAPI docs:

```text
http://127.0.0.1:8000/docs
```

The backend also serves the static dashboard at:

```text
http://127.0.0.1:8000
```

### 3. Run the React Frontend

Open a new terminal:

```bash
cd safe-path-guide
npm install
npm run dev
```

React app will run at the Vite URL shown in your terminal, usually:

```text
http://localhost:5173
```

The React frontend expects the API at:

```text
http://127.0.0.1:8000
```

To use a different backend URL, create `safe-path-guide/.env`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

---

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Serves the static dashboard |
| `GET` | `/api/summary` | Returns KPI summary, risk counts, top crimes, and safe areas |
| `GET` | `/api/charts` | Returns chart-ready analytics data |
| `GET` | `/api/map` | Returns geospatial points and area summaries |
| `GET` | `/api/options` | Returns dropdown options for prediction inputs |
| `GET` | `/api/area?name=<area>` | Returns risk details for a specific area |
| `POST` | `/api/predict` | Predicts safety risk for a scenario |

Example prediction request:

```bash
curl -X POST "http://127.0.0.1:8000/api/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "area_type": "market",
    "time_of_day": "night",
    "hour": 22,
    "day_of_week": "Friday",
    "is_weekend": 0,
    "crime_type": "harassment",
    "reported_incidents": 9,
    "lighting_condition": "poorly_lit",
    "crowd_density": "medium",
    "police_presence": "low",
    "cctv_coverage": "no",
    "proximity_to_police_station_km": 3.0,
    "population_density": "medium",
    "transport_availability": "moderate",
    "feel_unsafe_rating": 3,
    "weather": "clear",
    "cctv_available": 0,
    "police_patrol": 0,
    "previous_incidents_Monthly": 8,
    "police_station_Distance_km": 2.5,
    "public_transport_Available": 1
  }'
```

---

## EDA Notebook

The notebook `fullproject.ipynb` contains the exploratory analysis behind the project. Suggested EDA topics to highlight in screenshots:

- risk level distribution;
- crime type frequency;
- risk by time of day;
- risk by area type;
- lighting and police presence impact;
- weather-based risk patterns;
- geographic hotspot analysis.

---

## Future Improvements

- Add model evaluation metrics directly to the README.
- Save the trained model as a versioned artifact.
- Add authentication for community reports.
- Connect reports to a database instead of in-memory/mock state.
- Add deployment instructions for Render, Railway, Vercel, or Cloudflare.
- Add a public demo video or GIF.

---

## Author

Built by **Eshan** as a women safety prediction and city risk intelligence project.

If this project helps inspire safer, smarter city navigation, give it a star on GitHub.
