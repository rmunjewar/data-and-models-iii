import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { riskBucket, useStore } from "../store";

const COLORS = { high: "#ef4f6b", med: "#f4b740", low: "#4ade80" };

export default function Company() {
  const navigate = useNavigate();
  const employees = useStore((s) => s.employees);
  const averageTurnover = useStore((s) => s.averageTurnover);
  const companyContext = useStore((s) => s.companyContext);

  const { pieData, sorted } = useMemo(() => {
    const counts = { high: 0, med: 0, low: 0 };
    employees.forEach((e) => {
      counts[riskBucket(Number(e.turnover_probability_generated || 0))]++;
    });
    const pieData = [
      { name: "High risk", value: counts.high, key: "high" },
      { name: "Medium risk", value: counts.med, key: "med" },
      { name: "Low risk", value: counts.low, key: "low" },
    ];
    const sorted = [...employees].sort(
      (a, b) =>
        Number(b.turnover_probability_generated || 0) -
        Number(a.turnover_probability_generated || 0)
    );
    return { pieData, sorted };
  }, [employees]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1>{companyContext?.company_name}</h1>
          <p className="muted">{employees.length} employees analyzed</p>
        </div>
        <button className="secondary" onClick={() => navigate("/upload")}>← New upload</button>
      </div>

      <div className="dashboard" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Risk distribution</h2>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {pieData.map((d) => (
                    <Cell key={d.key} fill={COLORS[d.key as keyof typeof COLORS]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#181b22", border: "1px solid #2a2f3a" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2>Average turnover probability</h2>
          <div className="metric">{(averageTurnover * 100).toFixed(1)}%</div>
          <p className="muted">Across all uploaded employees</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Employees</h2>
        <ul className="emp-list">
          {sorted.map((e) => {
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
      </div>
    </>
  );
}
