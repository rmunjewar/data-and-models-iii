import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { riskBucket, useStore } from "../store";

const PAGE_SIZE = 15;
const COLORS = { high: "#ef4f6b", med: "#f4b740", low: "#4ade80" };
const TOOLTIP_STYLE = {
  contentStyle: { background: "#181b22", border: "1px solid #2a2f3a", color: "#e6e8ee" },
  itemStyle: { color: "#e6e8ee" },
  labelStyle: { color: "#e6e8ee" },
};

const avg = (vals: number[]) =>
  vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

export default function Company() {
  const navigate = useNavigate();
  const employees = useStore((s) => s.employees);
  const averageTurnover = useStore((s) => s.averageTurnover);
  const companyContext = useStore((s) => s.companyContext);
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<"risk-desc" | "risk-asc" | "name-asc" | "name-desc">("risk-desc");

  const stats = useMemo(() => {
    const counts = { high: 0, med: 0, low: 0 };
    employees.forEach((e) => {
      counts[riskBucket(Number(e.turnover_probability_generated || 0))]++;
    });
    const num = (k: string) =>
      employees
        .map((e) => Number(e[k]))
        .filter((v) => Number.isFinite(v));

    return {
      counts,
      avgStress: avg(num("stress_level")),
      avgSatisfaction: avg(num("satisfaction_score")),
      avgWorkload: avg(num("workload_score")),
      avgTeamSentiment: avg(num("team_sentiment")),
      avgOvertime: avg(num("overtime_hours")),
      avgTenure: avg(num("tenure_months")),
      pctHigh: counts.high / Math.max(employees.length, 1),
    };
  }, [employees]);

  const pieData = useMemo(
    () => [
      { name: "High risk", value: stats.counts.high, key: "high" },
      { name: "Medium risk", value: stats.counts.med, key: "med" },
      { name: "Low risk", value: stats.counts.low, key: "low" },
    ],
    [stats]
  );

  const deptData = useMemo(() => {
    const byDept: Record<string, number[]> = {};
    employees.forEach((e) => {
      const d = String(e.department || "Unknown");
      const p = Number(e.turnover_probability_generated || 0);
      (byDept[d] ??= []).push(p);
    });
    return Object.entries(byDept)
      .map(([department, arr]) => ({
        department,
        avg_risk: +(avg(arr) * 100).toFixed(1),
        count: arr.length,
      }))
      .sort((a, b) => b.avg_risk - a.avg_risk)
      .slice(0, 8);
  }, [employees]);

  const sorted = useMemo(() => {
    const arr = [...employees];
    arr.sort((a, b) => {
      if (sortBy === "risk-desc")
        return Number(b.turnover_probability_generated || 0) - Number(a.turnover_probability_generated || 0);
      if (sortBy === "risk-asc")
        return Number(a.turnover_probability_generated || 0) - Number(b.turnover_probability_generated || 0);
      const an = String(a.employee_id || "");
      const bn = String(b.employee_id || "");
      return sortBy === "name-asc" ? an.localeCompare(bn) : bn.localeCompare(an);
    });
    return arr;
  }, [employees, sortBy]);

  const tips = useMemo(() => {
    const t: { icon: string; text: string }[] = [];
    if (stats.pctHigh > 0.25)
      t.push({
        icon: "🚨",
        text: `${(stats.pctHigh * 100).toFixed(0)}% of your team is at high turnover risk — consider an org-wide pulse check this week.`,
      });
    if (stats.avgStress > 0.65)
      t.push({
        icon: "🧘",
        text: `Average stress level is ${(stats.avgStress * 100).toFixed(0)}%. Schedule no-meeting blocks and validate workload distribution.`,
      });
    if (stats.avgSatisfaction < 0.5)
      t.push({
        icon: "💬",
        text: `Satisfaction is below 50%. Run anonymous sentiment surveys and act on the top three themes within 30 days.`,
      });
    if (stats.avgOvertime > 10)
      t.push({
        icon: "⏱️",
        text: `Average overtime is ${stats.avgOvertime.toFixed(1)} hrs/wk. Audit on-call rotations and project staffing.`,
      });
    if (deptData[0] && deptData[0].avg_risk > 60)
      t.push({
        icon: "🏢",
        text: `${deptData[0].department} has the highest average risk (${deptData[0].avg_risk}%). Prioritize 1:1s with that team's manager.`,
      });
    if (!t.length)
      t.push({
        icon: "✅",
        text: "Your team metrics look healthy across the board. Keep reinforcing what's working with regular recognition.",
      });
    return t.slice(0, 4);
  }, [stats, deptData]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1>{companyContext?.company_name}</h1>
          <p className="muted">
            {employees.length} employees analyzed · {companyContext?.industry} · {companyContext?.company_size}
          </p>
        </div>
        <button className="secondary" onClick={() => navigate("/upload")}>← New upload</button>
      </div>

      {/* KPI strip */}
      <div className="grid-4" style={{ marginTop: 16 }}>
        <div className="stat accent">
          <div className="label">Avg turnover risk</div>
          <div className="value">{(averageTurnover * 100).toFixed(1)}%</div>
        </div>
        <div className="stat high">
          <div className="label">High-risk employees</div>
          <div className="value">{stats.counts.high}</div>
        </div>
        <div className="stat accent-2">
          <div className="label">Avg satisfaction</div>
          <div className="value">{(stats.avgSatisfaction * 100).toFixed(0)}%</div>
        </div>
        <div className="stat accent-3">
          <div className="label">Avg stress level</div>
          <div className="value">{(stats.avgStress * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Charts */}
      <div className="dashboard" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Risk distribution</h2>
          <div className="chart-wrap" style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {pieData.map((d) => (
                    <Cell key={d.key} fill={COLORS[d.key as keyof typeof COLORS]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ color: "#e6e8ee" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2>Risk by department</h2>
          <div className="chart-wrap" style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={deptData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid stroke="#2a2f3a" strokeDasharray="3 3" />
                <XAxis dataKey="department" stroke="#8b93a7" fontSize={11} interval={0} angle={-15} dy={6} height={50} />
                <YAxis stroke="#8b93a7" fontSize={11} unit="%" />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="avg_risk" radius={[6, 6, 0, 0]}>
                  {deptData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.avg_risk >= 60
                          ? "#ef4f6b"
                          : d.avg_risk >= 30
                          ? "#f4b740"
                          : "#4ade80"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2>💡 Insights & tips</h2>
        <div style={{ marginTop: 12 }}>
          {tips.map((t, i) => (
            <div className="tip" key={i}>
              <span className="icon">{t.icon}</span>
              <span className="body">{t.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Employee list */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Employees</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ margin: 0 }}>Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as any); setPage(0); }}
              style={{ width: "auto" }}
            >
              <option value="risk-desc">Risk (high → low)</option>
              <option value="risk-asc">Risk (low → high)</option>
              <option value="name-asc">Name (A → Z)</option>
              <option value="name-desc">Name (Z → A)</option>
            </select>
          </div>
        </div>
        <ul className="emp-list">
          {sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((e) => {
            const p = Number(e.turnover_probability_generated || 0);
            const bucket = riskBucket(p);
            return (
              <li
                key={e.employee_id}
                className="emp-row"
                onClick={() => navigate(`/employee/${e.employee_id}`)}
              >
                <div>
                  <div className="name">{e.employee_id}</div>
                  <div className="meta">
                    {e.role || "—"} · {e.department || "—"} · {e.job_level || "—"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={`pill ${bucket}`}>{(p * 100).toFixed(0)}% risk</span>
                </div>
              </li>
            );
          })}
        </ul>
        {sorted.length > PAGE_SIZE && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <button
              className="secondary"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              ← Prev
            </button>
            <span className="muted">
              Page {page + 1} of {Math.ceil(sorted.length / PAGE_SIZE)} · {sorted.length} employees
            </span>
            <button
              className="secondary"
              onClick={() =>
                setPage((p) =>
                  Math.min(Math.ceil(sorted.length / PAGE_SIZE) - 1, p + 1)
                )
              }
              disabled={(page + 1) * PAGE_SIZE >= sorted.length}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
