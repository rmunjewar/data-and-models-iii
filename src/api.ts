import type { CompanyContext, Employee } from "./store";

export type Recommendation = {
  employee_id: string;
  risk_level: "High" | "Medium" | "Low";
  turnover_probability: number;
  key_risk_factors: string[];
  recommendations: string[];
};

export async function uploadCsv(csvText: string): Promise<{
  count: number;
  average_turnover_probability: number;
  employees: Employee[];
}> {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csvText,
  });
  if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
  return res.json();
}

export async function fetchRecommendation(
  employee: Employee,
  company_context: CompanyContext | null
): Promise<Recommendation> {
  const res = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employee, company_context }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Recommendation failed");
  return res.json();
}
