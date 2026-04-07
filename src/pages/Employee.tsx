import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchRecommendation, type Recommendation } from "../api";
import { riskBucket, useStore } from "../store";

export default function Employee() {
  const { id } = useParams();
  const navigate = useNavigate();
  const employee = useStore((s) => s.employees.find((e) => e.employee_id === id));
  const companyContext = useStore((s) => s.companyContext);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!employee) return;
    setLoading(true);
    setError("");
    fetchRecommendation(employee, companyContext)
      .then(setRec)
      .catch((e) => setError(e.message || "Failed to load recommendations"))
      .finally(() => setLoading(false));
  }, [employee, companyContext]);

  if (!employee) {
    return (
      <div className="card">
        <p>Employee not found.</p>
        <button onClick={() => navigate("/company")}>← Back</button>
      </div>
    );
  }

  const p = Number(employee.turnover_probability_generated || 0);
  const bucket = riskBucket(p);

  return (
    <>
      <button className="secondary" onClick={() => navigate("/company")}>← Back to company</button>
      <div className="detail" style={{ marginTop: 16 }}>
        <div className="card left">
          <h2>{employee.employee_id}</h2>
          <p className="muted">
            {employee.role || "—"} · {employee.department || "—"}
          </p>
          <div style={{ marginTop: 14 }}>
            <div className="muted">Job level</div>
            <div>{employee.job_level || "—"}</div>
          </div>
          {employee.tenure_months != null && (
            <div style={{ marginTop: 14 }}>
              <div className="muted">Tenure</div>
              <div>{employee.tenure_months} months</div>
            </div>
          )}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <div className="muted">Turnover probability</div>
            <div className="metric" style={{ color: `var(--${bucket})` }}>
              {(p * 100).toFixed(1)}%
            </div>
            <span className={`pill ${bucket}`}>
              {bucket === "high" ? "High risk" : bucket === "med" ? "Medium risk" : "Low risk"}
            </span>
          </div>
        </div>

        <div className="card right">
          <h2>Action items</h2>
          {loading && <div className="spinner">Generating recommendations…</div>}
          {error && <div className="error">{error}</div>}
          {rec && (
            <>
              <div className="factors">
                {rec.key_risk_factors.map((f, i) => (
                  <span key={i} className="factor">{f}</span>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                {rec.recommendations.map((r, i) => (
                  <div key={i} className="action">
                    <strong>{i + 1}.</strong> {r}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
