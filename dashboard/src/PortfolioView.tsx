import { usePortfolioStatus } from "./hooks/usePortfolioStatus";
import { ProjectCard } from "./components/ProjectCard";
import type { PortfolioSnapshot } from "../shared/types";
import "./Portfolio.css";

function PortfolioSummary({ data }: { data: PortfolioSnapshot }) {
  const { summary } = data;
  return (
    <section className="portfolio-summary panel">
      <div className="summary-item">
        <span className="summary-num">{summary.totalProjects}</span>
        <span className="summary-label">Proyectos</span>
      </div>
      <div className="summary-item ok">
        <span className="summary-num">{summary.healthy}</span>
        <span className="summary-label">Operativos</span>
      </div>
      <div className="summary-item warn">
        <span className="summary-num">{summary.degraded}</span>
        <span className="summary-label">Revisar</span>
      </div>
      <div className="summary-item err">
        <span className="summary-num">{summary.error}</span>
        <span className="summary-label">Atención</span>
      </div>
      <div className="summary-item">
        <span className="summary-num">{summary.totalOpenPrs}</span>
        <span className="summary-label">PRs abiertos</span>
      </div>
    </section>
  );
}

export default function PortfolioView() {
  const { data, error, loading, lastFetch, isStatic } = usePortfolioStatus(60_000);

  if (loading && !data) {
    return <div className="loading">Cargando portfolio…</div>;
  }

  if (error && !data) {
    return (
      <div className="loading error">
        No se pudo conectar al API de portfolio.
        <br />
        <code>ssh -N -L 3099:127.0.0.1:3099 claude@tu-vps</code>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="app portfolio-app">
      <header className="header">
        <h1>Portfolio · Command Center</h1>
        <p className="subtitle">
          Vista gerencial multi-proyecto · sync{" "}
          {new Date(data.generatedAt).toLocaleString("es")}
          {lastFetch && ` · fetch ${lastFetch.toLocaleTimeString("es")}`}
          {isStatic && " · snapshot GitHub Pages · datos cada ~15 min · auto-refresh 5 min"}
        </p>
      </header>

      <PortfolioSummary data={data} />

      <section className="project-grid">
        {data.projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </section>
    </div>
  );
}
