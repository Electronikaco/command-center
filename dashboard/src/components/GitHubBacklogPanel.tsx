import type { GithubBacklog } from "../../shared/types";

export function GitHubBacklogPanel({ backlog }: { backlog: GithubBacklog }) {
  const pending = backlog.items.filter((i) => i.kind === "pending");
  const stale = backlog.items.filter((i) => i.kind === "stale");
  const other = backlog.items.filter((i) => i.kind === "other");

  return (
    <div className="panel github-backlog">
      <div className="gb-head">
        <h2>Backlog GitHub</h2>
        <span className="gb-count">{backlog.openCount} abiertas</span>
      </div>

      <div className="gb-summary">
        <span className="gb-pill pending">{backlog.pendingCount} trabajo pendiente</span>
        {backlog.staleCount > 0 && (
          <span className="gb-pill stale">{backlog.staleCount} issue obsoleta</span>
        )}
        {other.length > 0 && (
          <span className="gb-pill other">{other.length} sin UC mapeada</span>
        )}
      </div>

      {pending.length === 0 && stale.length === 0 && other.length === 0 ? (
        <p className="muted">Sin issues abiertas en GitHub.</p>
      ) : (
        <ul className="gb-list">
          {[...pending, ...other, ...stale].map((item) => (
            <li key={item.number} className={`gb-item kind-${item.kind}`}>
              <a href={item.url} target="_blank" rel="noreferrer">
                #{item.number}
              </a>
              {item.code && <code>{item.code}</code>}
              <span className="gb-title">{item.title}</span>
              {item.kind === "stale" && (
                <span className="gb-tag">merge hecho · cerrar issue</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .github-backlog h2 {
          margin: 0;
          font-size: 0.9rem;
        }
        .gb-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 0.6rem;
        }
        .gb-count {
          font-size: 0.72rem;
          color: var(--muted);
        }
        .gb-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-bottom: 0.65rem;
        }
        .gb-pill {
          font-size: 0.65rem;
          padding: 0.2rem 0.45rem;
          border-radius: 999px;
          border: 1px solid var(--border);
        }
        .gb-pill.pending {
          color: var(--warn);
          border-color: var(--warn);
          background: #d9775722;
        }
        .gb-pill.stale {
          color: var(--muted);
        }
        .gb-pill.other {
          color: var(--muted);
        }
        .gb-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.35rem;
          max-height: 220px;
          overflow-y: auto;
        }
        .gb-item {
          display: grid;
          grid-template-columns: auto auto 1fr auto;
          gap: 0.4rem;
          align-items: center;
          font-size: 0.68rem;
          padding: 0.35rem 0.45rem;
          border-radius: 8px;
          background: #0a0c10;
          border: 1px solid var(--border);
        }
        .gb-item.kind-pending {
          border-color: #d9775744;
        }
        .gb-item.kind-stale {
          opacity: 0.72;
        }
        .gb-item a {
          color: var(--accent);
          text-decoration: none;
          font-weight: 700;
        }
        .gb-item code {
          font-size: 0.62rem;
          color: var(--muted);
        }
        .gb-title {
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gb-tag {
          font-size: 0.58rem;
          color: var(--muted);
          white-space: nowrap;
        }
        .muted { color: var(--muted); font-size: 0.85rem; }
      `}</style>
    </div>
  );
}
