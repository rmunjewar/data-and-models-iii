import { create } from "zustand";

export type Employee = Record<string, any> & {
  employee_id: string;
  role?: string;
  department?: string;
  job_level?: string;
  turnover_probability_generated?: number;
};

export type CompanyContext = {
  company_name: string;
  industry: string;
  company_size: string;
  manager_notes: string;
};

type State = {
  companyContext: CompanyContext | null;
  employees: Employee[];
  averageTurnover: number;
  setCompanyContext: (c: CompanyContext) => void;
  setEmployees: (e: Employee[], avg: number) => void;
  reset: () => void;
};

export const useStore = create<State>((set) => ({
  companyContext: null,
  employees: [],
  averageTurnover: 0,
  setCompanyContext: (c) => set({ companyContext: c }),
  setEmployees: (employees, averageTurnover) => set({ employees, averageTurnover }),
  reset: () => set({ companyContext: null, employees: [], averageTurnover: 0 }),
}));

export const riskBucket = (p: number): "high" | "med" | "low" =>
  p >= 0.6 ? "high" : p >= 0.3 ? "med" : "low";
