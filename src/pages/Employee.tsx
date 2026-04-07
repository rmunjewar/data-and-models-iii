import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { fetchRecommendation, type Recommendation } from "../api";
import { riskBucket, useStore } from "../store";

const TOOLTIP_STYLE = {
  contentStyle: { background: "#181b22", border: "1px solid #2a2f3a", color: "#e6e8ee" },
  itemStyle: { color: "#e6e8ee" },
  labelStyle: { color: "#e6e8ee" },
};

const formatTenure = (months: number) => {
  const total = Math.max(0, Math.round(months));
  const y = Math.floor(total / 12);
  const m = total % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} ${y === 1 ? "year" : "years"}`);
  if (m || !y) parts.push(`${m} ${m === 1 ? "month" : "months"}`);
  return parts.join(" ");
};

export default function Employee() {
  const { id } = useParams();
  const navigate = useNavigate();
  const employee = useStore((s) => s.employees.find((e) => e.employee_id === id));
  const employees = useStore((s) => s.employees);
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

  const radarData = useMemo(() => {
    if (!employee) return [];
    const fields: { key: string; label: string; invert?: boolean }[] = [
      { key: "satisfaction_score", label: "Satisfaction" },
      { key: "team_sentiment", label: "Team sentiment" },
      { key: "performance_score", label: "Performance" },
      { key: "collaboration_score", label: "Collaboration" },
      { key: "goal_achievement_rate", label: "Goal achievement" },
      { key: "stress_level", label: "Calm", invert: true },
      { key: "workload_score", label: "Sustainable load", invert: true },
    ];
    return fields.map((f) => {
      const raw = Number(employee[f.key]);
      const val = Number.isFinite(raw) ? (f.invert ? 1 - raw : raw) : 0;
      return { metric: f.label, value: +(val * 100).toFixed(0) };
    });
  }, [employee]);

  const peerComparison = useMemo(() => {
    if (!employee) return null;
    const num = (k: string) =>
      employees.map((e) => Number(e[k])).filter((v) => Number.isFinite(v));
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return {
      stress: { me: Number(employee.stress_level || 0), team: avg(num("stress_level")) },
      satisfaction: { me: Number(employee.satisfaction_score || 0), team: avg(num("satisfaction_score")) },
      workload: { me: Number(employee.workload_score || 0), team: avg(num("workload_score")) },
      overtime: { me: Number(employee.overtime_hours || 0), team: avg(num("overtime_hours")) },
    };
  }, [employee, employees]);

  const tips = useMemo(() => {
    if (!employee) return [];
    const t: { icon: string; text: string }[] = [];
    const stress = Number(employee.stress_level || 0);
    const sat = Number(employee.satisfaction_score || 0);
    const wl = Number(employee.workload_score || 0);
    const ot = Number(employee.overtime_hours || 0);
    const ts = Number(employee.team_sentiment || 0);
    const cp = Number(employee.career_progression_score || 0);
    if (stress > 0.7)
      t.push({ icon: "🧘", text: "Stress is critically high — consider an immediate workload audit and a recovery week." });
    if (sat < 0.4)
      t.push({ icon: "💬", text: "Low satisfaction — schedule a candid 1:1 to surface root causes." });
    if (wl > 0.75)
      t.push({ icon: "⚖️", text: "Workload exceeds sustainable levels — redistribute or deprioritize work." });
    if (ot > 12)
      t.push({ icon: "⏱️", text: `Overtime averages ${ot.toFixed(0)} hrs/wk — set a hard cap and protect evenings.` });
    if (ts < 0.4)
      t.push({ icon: "🤝", text: "Team sentiment is low — investigate interpersonal dynamics or manager fit." });
    if (cp < 0.4)
      t.push({ icon: "📈", text: "Career progression score is weak — co-create a 6-month growth plan." });
    if (!t.length)
      t.push({ icon: "✅", text: "This employee is in good shape — keep reinforcing what's working." });
    return t.slice(0, 4);
  }, [employee]);

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

  const Bar = ({ me, team, label, unit = "%", scale = 100 }: any) => {
    const mePct = Math.min(100, (me / (unit === "%" ? 1 : Math.max(team * 2, me, 1))) * scale);
    const teamPct = Math.min(100, (team / (unit === "%" ? 1 : Math.max(team * 2, me, 1))) * scale);
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span className="muted">{label}</span>
          <span>
            {unit === "%" ? `${(me * 100).toFixed(0)}%` : `${me.toFixed(1)}`}
            <span className="muted"> · team {unit === "%" ? `${(team * 100).toFixed(0)}%` : team.toFixed(1)}</span>
          </span>
        </div>
        <div style={{ position: "relative", height: 8, background: "var(--panel-2)", borderRadius: 999, marginTop: 6 }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${mePct}%`, background: "var(--accent)", borderRadius: 999 }} />
          <div style={{ position: "absolute", left: `${teamPct}%`, top: -2, height: 12, width: 2, background: "var(--accent-4)" }} />
        </div>
      </div>
    );
  };

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
              <div>{formatTenure(Number(employee.tenure_months))}</div>
            </div>
          )}
          {employee.salary != null && (
            <div style={{ marginTop: 14 }}>
              <div className="muted">Salary</div>
              <div>${Number(employee.salary).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
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

          {peerComparison && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: 16 }}>Vs. team average</h2>
              <div style={{ marginTop: 12 }}>
                <Bar label="Stress" me={peerComparison.stress.me} team={peerComparison.stress.team} />
                <Bar label="Satisfaction" me={peerComparison.satisfaction.me} team={peerComparison.satisfaction.team} />
                <Bar label="Workload" me={peerComparison.workload.me} team={peerComparison.workload.team} />
                <Bar label="Overtime hrs/wk" me={peerComparison.overtime.me} team={peerComparison.overtime.team} unit="h" />
              </div>
            </div>
          )}
        </div>

        <div className="card right">
          <h2>Wellbeing snapshot</h2>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#2a2f3a" />
                <PolarAngleAxis dataKey="metric" stroke="#8b93a7" fontSize={11} />
                <Radar
                  dataKey="value"
                  stroke="#a78bfa"
                  fill="#a78bfa"
                  fillOpacity={0.35}
                />
                <Tooltip {...TOOLTIP_STYLE} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <h2 style={{ marginTop: 20 }}>💡 Quick tips</h2>
          <div style={{ marginTop: 8 }}>
            {tips.map((t, i) => (
              <div className="tip" key={i}>
                <span className="icon">{t.icon}</span>
                <span className="body">{t.text}</span>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: 20 }}>Action items</h2>
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
