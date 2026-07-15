import type { HealthLevel, ProjectSnapshot } from "../../shared/types";

const HEALTH_LABEL: Record<HealthLevel, string> = {
  ok: "Operativo",
  degraded: "Revisar",
  error: "Atención",
};

function formatActivity(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days}d`;
}

interface Props {
  project: ProjectSnapshot;
}

export function ProjectCard({ project }: Props) {
  const githubUrl =
    project.links?.github ?? `https://github.com/${project.ghRepo}`;

  return (
    <article className={`project-card health-${project.health}`}>
      <header className="project-card-header">
        <span className={`health-dot health-dot-${project.health}`} />
        <div className="project-card-title">
          <h2>{project.name}</h2>
          <span className="project-org">{project.org}</span>
        </div>
        <span className={`health-badge health-badge-${project.health}`}>
          {HEALTH_LABEL[project.health]}
        </span>
      </header>

      {project.description && (
        <p className="project-desc muted">{project.description}</p>
      )}

      <div className="project-metrics">
        {project.progress.percent !== null ? (
          <div className="metric-row">
            <span className="metric-label">Avance</span>
            <div className="progress-wrap">
              <div
                className="progress-bar"
                style={{ width: `${project.progress.percent}%` }}
              />
            </div>
            <span className="metric-value">{project.progress.percent}%</span>
          </div>
        ) : null}
        <p className="progress-label">{project.progress.label}</p>

        <div className="metric-chips">
          <span className="chip">PRs: {project.openPrs}</span>
          {project.mergedPrs30d > 0 && (
            <span className="chip">Merge 30d: {project.mergedPrs30d}</span>
          )}
          {project.commits7d > 0 && (
            <span className="chip">Commits 7d: {project.commits7d}</span>
          )}
          <span className="chip">Activo: {formatActivity(project.lastActivityAt)}</span>
        </div>
      </div>

      {project.highlights.length > 0 && (
        <ul className="project-highlights">
          {project.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}

      <footer className="project-card-footer">
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="card-link"
        >
          Abrir en GitHub ↗
        </a>
      </footer>
    </article>
  );
}
