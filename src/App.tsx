import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Upload from "./pages/Upload";
import Company from "./pages/Company";
import Employee from "./pages/Employee";
import { useStore } from "./store";

function RequireContext({ children }: { children: JSX.Element }) {
  const ctx = useStore((s) => s.companyContext);
  return ctx ? children : <Navigate to="/" replace />;
}

function RequireData({ children }: { children: JSX.Element }) {
  const employees = useStore((s) => s.employees);
  return employees.length ? children : <Navigate to="/upload" replace />;
}

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/upload"
          element={
            <RequireContext>
              <Upload />
            </RequireContext>
          }
        />
        <Route
          path="/company"
          element={
            <RequireContext>
              <RequireData>
                <Company />
              </RequireData>
            </RequireContext>
          }
        />
        <Route
          path="/employee/:id"
          element={
            <RequireContext>
              <RequireData>
                <Employee />
              </RequireData>
            </RequireContext>
          }
        />
      </Routes>
    </div>
  );
}
