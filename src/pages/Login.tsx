import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";

export default function Login() {
  const navigate = useNavigate();
  const setCompanyContext = useStore((s) => s.setCompanyContext);
  const [form, setForm] = useState({
    company_name: "",
    industry: "",
    company_size: "",
    manager_notes: "",
  });

  const handle = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyContext(form);
    navigate("/upload");
  };

  return (
    <div className="card" style={{ maxWidth: 640, margin: "60px auto", padding: "40px 44px" }}>
      <h1>TeamPulse</h1>
      <p className="muted">Tell us about your company so we can tailor recommendations.</p>
      <form onSubmit={submit} style={{ marginTop: 20 }}>
        <div className="row">
          <div>
            <label>Company name</label>
            <input required value={form.company_name} onChange={handle("company_name")} />
          </div>
          <div>
            <label>Industry</label>
            <input required value={form.industry} onChange={handle("industry")} placeholder="e.g. SaaS, Healthcare" />
          </div>
        </div>
        <div>
          <label>Company size</label>
          <input required value={form.company_size} onChange={handle("company_size")} placeholder="e.g. 50-200 employees" />
        </div>
        <div>
          <label>Manager notes (optional context for the LLM)</label>
          <textarea
            value={form.manager_notes}
            onChange={handle("manager_notes")}
            placeholder="Anything the AI should know about your team, culture, or current initiatives..."
          />
        </div>
        <button type="submit">Continue →</button>
      </form>
    </div>
  );
}
