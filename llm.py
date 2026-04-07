import json
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parent / ".env")

_api_key = os.getenv("GROQ_API_KEY")
if not _api_key:
    raise ValueError(
        "GROQ_API_KEY is not set. "
        "Add it to .env next to this file or export it in your shell."
    )

client = Groq(api_key=_api_key)

GROQ_MODEL = "llama-3.1-8b-instant"

NUMERICAL_FEATURES = [
    "tenure_months", "salary", "performance_score", "satisfaction_score",
    "workload_score", "team_sentiment", "project_completion_rate",
    "overtime_hours", "training_participation", "collaboration_score",
    "email_sentiment", "slack_activity", "meeting_participation",
    "goal_achievement_rate", "stress_level",
    "role_complexity_score", "career_progression_score",
]

CATEGORICAL_FEATURES = ["job_level", "department"]

CONTEXT_TEXT_COLUMNS = [
    "recent_feedback", "communication_patterns",
    "risk_factors_summary", "turnover_reason",
]

TARGET_COLUMN = "turnover_probability_generated"

TRIMMED_DATA_PATH = Path(__file__).resolve().parent / "trimmed_data"


class RecommendationResponse(BaseModel):
    employee_id: str
    risk_level: str
    turnover_probability: float
    key_risk_factors: list[str]
    recommendations: list[str]


class HealthResponse(BaseModel):
    status: str
    model: str
    data_loaded: bool
    employee_count: int


class EmployeeSummary(BaseModel):
    employee_id: str
    role: str
    department: str
    job_level: str
    turnover_probability: float


def load_employee_data(csv_path: Path = TRIMMED_DATA_PATH) -> pd.DataFrame:
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Cannot find '{csv_path}'. "
            "Run model.ipynb first to generate the trimmed_data CSV."
        )
    return pd.read_csv(csv_path, index_col=0)


def build_employee_context(row: pd.Series) -> dict:
    context: dict = {
        "employee_id": str(row.get("employee_id", "UNKNOWN")),
        "role": str(row.get("role", "")),
        "department": str(row.get("department", "")),
        "job_level": str(row.get("job_level", "")),
    }

    for col in NUMERICAL_FEATURES:
        val = row.get(col)
        if pd.notna(val):
            context[col] = round(float(val), 4)

    for col in CONTEXT_TEXT_COLUMNS:
        val = row.get(col)
        if pd.notna(val) and str(val).strip():
            context[col] = str(val).strip()

    context["ml_turnover_probability"] = round(
        float(row.get(TARGET_COLUMN, 0.0)), 4
    )

    return context


SYSTEM_PROMPT = """\
You are an expert HR assistant for small businesses.
You will receive structured employee data that includes both quantitative
metrics (scored 0-1 or in raw units) and a machine-learning-predicted
turnover probability (0 = very unlikely to leave, 1 = almost certain).

Your task:
1. Classify the employee's risk level as High (>= 0.6), Medium (0.3-0.6),
   or Low (< 0.3) based on the ML turnover probability.
2. Identify the 2-3 most critical risk factors from the data.
3. Provide exactly 3 actionable, highly specific recommendations the
   manager can implement within 30 days to reduce burnout and attrition.

You MUST respond in raw JSON with this exact schema:
{
    "employee_id": "string",
    "risk_level": "High" | "Medium" | "Low",
    "turnover_probability": float,
    "key_risk_factors": ["string", ...],
    "recommendations": ["string", "string", "string"]
}
Do NOT wrap the JSON in markdown code fences or add any text outside it.\
"""


def generate_recommendation(employee_data: dict) -> dict:
    user_message = (
        "Analyze this employee and return your recommendation JSON:\n"
        + json.dumps(employee_data, indent=2)
    )

    chat_completion = client.chat.completions.create(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ],
        model=GROQ_MODEL,
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    raw = chat_completion.choices[0].message.content
    return json.loads(raw)


app = FastAPI(
    title="Employee Retention LLM API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
def health_check():
    try:
        df = load_employee_data()
        return HealthResponse(
            status="ok",
            model=GROQ_MODEL,
            data_loaded=True,
            employee_count=len(df),
        )
    except FileNotFoundError:
        return HealthResponse(
            status="ok",
            model=GROQ_MODEL,
            data_loaded=False,
            employee_count=0,
        )


@app.get("/api/employees", response_model=list[EmployeeSummary])
def list_employees(
    limit: int = Query(20, ge=1, le=200),
    sort_by_risk: bool = Query(True),
):
    try:
        df = load_employee_data()
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="trimmed_data CSV not found. Run model.ipynb first.",
        )

    if sort_by_risk:
        df = df.sort_values(TARGET_COLUMN, ascending=False)

    rows = df.head(limit)
    return [
        EmployeeSummary(
            employee_id=str(r.get("employee_id", "")),
            role=str(r.get("role", "")),
            department=str(r.get("department", "")),
            job_level=str(r.get("job_level", "")),
            turnover_probability=round(float(r.get(TARGET_COLUMN, 0)), 4),
        )
        for _, r in rows.iterrows()
    ]


@app.get(
    "/api/recommendations/{employee_id}",
    response_model=RecommendationResponse,
)
def get_recommendation(employee_id: str):
    try:
        df = load_employee_data()
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="trimmed_data CSV not found. Run model.ipynb first.",
        )

    match = df[df["employee_id"] == employee_id]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Employee {employee_id} not found")

    ctx = build_employee_context(match.iloc[0])
    result = generate_recommendation(ctx)
    return RecommendationResponse(**result)


@app.get(
    "/api/recommendations",
    response_model=list[RecommendationResponse],
)
def get_top_recommendations(
    limit: int = Query(5, ge=1, le=20),
):
    try:
        df = load_employee_data()
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="trimmed_data CSV not found. Run model.ipynb first.",
        )

    top = df.sort_values(TARGET_COLUMN, ascending=False).head(limit)

    results = []
    for _, row in top.iterrows():
        ctx = build_employee_context(row)
        rec = generate_recommendation(ctx)
        results.append(RecommendationResponse(**rec))

    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("llm:app", host="127.0.0.1", port=8000, reload=True)
