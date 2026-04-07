"""TeamPulse FastAPI backend.

Run with:
    uvicorn llm:app --reload --port 8000

Endpoints:
    GET  /api/health
    POST /api/upload      body: raw CSV text  -> {employees, average_turnover_probability}
    POST /api/recommend   body: {employee, company_context} -> RecommendationResponse
"""
import io
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parent / ".env")

GROQ_MODEL = "llama-3.1-8b-instant"
TARGET = "turnover_probability_generated"

NUMERICAL_FEATURES = [
    "tenure_months", "salary", "performance_score", "satisfaction_score",
    "workload_score", "team_sentiment", "project_completion_rate",
    "overtime_hours", "training_participation", "collaboration_score",
    "email_sentiment", "slack_activity", "meeting_participation",
    "goal_achievement_rate", "stress_level",
    "role_complexity_score", "career_progression_score",
]
CONTEXT_TEXT_COLUMNS = [
    "recent_feedback", "communication_patterns",
    "risk_factors_summary", "turnover_reason",
]
POSITIVE_RISK = ["stress_level", "workload_score", "overtime_hours"]
NEGATIVE_RISK = [
    "satisfaction_score", "team_sentiment", "performance_score",
    "collaboration_score", "email_sentiment", "meeting_participation",
    "goal_achievement_rate", "career_progression_score", "project_completion_rate",
]

SYSTEM_PROMPT_BASE = """\
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
Do NOT wrap the JSON in markdown code fences or add any text outside it."""


def _client() -> Groq:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not set")
    return Groq(api_key=key)


def _norm(series: pd.Series) -> pd.Series:
    s = pd.to_numeric(series, errors="coerce").fillna(0)
    lo, hi = s.min(), s.max()
    if hi - lo < 1e-9:
        return pd.Series(np.zeros(len(s)), index=s.index)
    return (s - lo) / (hi - lo)


def predict(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    if TARGET in df.columns and df[TARGET].notna().any():
        df[TARGET] = pd.to_numeric(df[TARGET], errors="coerce").fillna(0).clip(0, 1)
        return df
    pos_cols = [c for c in POSITIVE_RISK if c in df.columns]
    neg_cols = [c for c in NEGATIVE_RISK if c in df.columns]
    if not pos_cols and not neg_cols:
        df[TARGET] = 0.5
        return df
    pos = sum((_norm(df[c]) for c in pos_cols), pd.Series(np.zeros(len(df)), index=df.index))
    neg = sum((_norm(df[c]) for c in neg_cols), pd.Series(np.zeros(len(df)), index=df.index))
    score = 0.5 + 0.5 * (pos / max(len(pos_cols), 1) - neg / max(len(neg_cols), 1))
    df[TARGET] = score.clip(0, 1).round(4)
    return df


def build_employee_context(row: dict) -> dict:
    ctx: dict = {
        "employee_id": str(row.get("employee_id", "UNKNOWN")),
        "role": str(row.get("role", "")),
        "department": str(row.get("department", "")),
        "job_level": str(row.get("job_level", "")),
    }
    for col in NUMERICAL_FEATURES:
        val = row.get(col)
        if val is not None and not (isinstance(val, float) and pd.isna(val)):
            try:
                ctx[col] = round(float(val), 4)
            except (TypeError, ValueError):
                pass
    for col in CONTEXT_TEXT_COLUMNS:
        val = row.get(col)
        if val is not None and str(val).strip() and str(val).lower() != "nan":
            ctx[col] = str(val).strip()
    try:
        ctx["ml_turnover_probability"] = round(float(row.get(TARGET, 0.0)), 4)
    except (TypeError, ValueError):
        ctx["ml_turnover_probability"] = 0.0
    return ctx


def generate_recommendation(employee_ctx: dict, company_context: dict | None = None) -> dict:
    sys_prompt = SYSTEM_PROMPT_BASE
    if company_context:
        sys_prompt += "\n\nCompany context:\n" + json.dumps(company_context, indent=2)
    user_message = "Analyze this employee and return your recommendation JSON:\n" + json.dumps(employee_ctx, indent=2)
    completion = _client().chat.completions.create(
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_message},
        ],
        model=GROQ_MODEL,
        temperature=0.2,
        response_format={"type": "json_object"},
    )
    return json.loads(completion.choices[0].message.content)


class RecommendationResponse(BaseModel):
    employee_id: str
    risk_level: str
    turnover_probability: float
    key_risk_factors: list[str]
    recommendations: list[str]


class RecommendRequest(BaseModel):
    employee: dict
    company_context: dict | None = None


app = FastAPI(title="TeamPulse API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "model": GROQ_MODEL}


@app.post("/api/upload")
async def upload(request: Request):
    raw = await request.body()
    csv_text = raw.decode("utf-8", errors="replace")
    if not csv_text.strip():
        raise HTTPException(status_code=400, detail="Empty CSV body")
    try:
        df = pd.read_csv(io.StringIO(csv_text))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")
    df = predict(df)
    avg = float(pd.to_numeric(df[TARGET], errors="coerce").mean() or 0)
    employees = json.loads(df.to_json(orient="records"))
    return {
        "count": len(employees),
        "average_turnover_probability": round(avg, 4),
        "employees": employees,
    }


@app.post("/api/recommend", response_model=RecommendationResponse)
def recommend(req: RecommendRequest):
    if not req.employee:
        raise HTTPException(status_code=400, detail="Missing 'employee'")
    ctx = build_employee_context(req.employee)
    result = generate_recommendation(ctx, req.company_context)
    return RecommendationResponse(**result)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("llm:app", host="127.0.0.1", port=8000, reload=True)
