export default function Footer() {
  return (
    <footer className="app-footer">
      <div>
        <span className="brand">TeamPulse</span> · AI-powered employee retention intelligence
      </div>
      <div>
        © {new Date().getFullYear()} TeamPulse · Built with React + FastAPI + Groq
      </div>
    </footer>
  );
}
