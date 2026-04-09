import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadCsv } from "../api";
import { useStore } from "../store";

export default function Upload() {
  const navigate = useNavigate();
  const setEmployees = useStore((s) => s.setEmployees);
  const companyContext = useStore((s) => s.companyContext);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const text = await file.text();
      const result = await uploadCsv(text);
      setEmployees(result.employees, result.average_turnover_probability);
      navigate("/company");
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 720, margin: "60px auto" }}>
      <h1>Upload data</h1>
      <p className="muted">
        Welcome, {companyContext?.company_name}. Drop a CSV with HR + sentiment data
        for your team.
      </p>
      <div
        className={`dropzone ${dragging ? "drag" : ""}`}
        style={{ marginTop: 20 }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        {file ? (
          <div>
            <strong>{file.name}</strong>
            <div className="muted">{(file.size / 1024).toFixed(1)} KB</div>
          </div>
        ) : (
          <div className="muted">Drop your CSV here, or click to browse</div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          hidden
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>
      {error && <div className="error">{error}</div>}
      <button onClick={submit} disabled={!file || loading}>
        {loading ? "Processing..." : "Enter →"}
      </button>
    </div>
  );
}
