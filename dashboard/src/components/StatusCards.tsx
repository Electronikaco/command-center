import type { OrchestratorSnapshot } from "../../shared/types";

export function StatusCards({ data }: { data: OrchestratorSnapshot }) {
  const o = data.orchestrator;
  const a = data.agent;

  return (
    <div className="status-cards">
      <div className="card">
        <span className="card-k">Estado</span>
        <span className="card-v">{o.estado || "—"}</span>
      </div>
      <div className="card">
        <span className="card-k">Rama</span>
        <span className="card-v mono">{o.rama || "—"}</span>
      </div>
      <div className="card wide">
        <span className="card-k">Tarea</span>
        <span className="card-v">{o.tarea || "—"}</span>
      </div>
      <div className="card">
        <span className="card-k">Lock Opus</span>
        <span className="card-v">
          {a.lockActive ? `Activo (${a.lockAgeMin ?? "?"} min)` : "Libre"}
        </span>
      </div>
      <div className="card">
        <span className="card-k">Proceso Opus</span>
        <span className="card-v">{a.processActive ? "Sí" : "No"}</span>
      </div>
      <div className="card wide">
        <span className="card-k">Bloqueos</span>
        <span className="card-v">{o.bloqueos || "ninguno"}</span>
      </div>
      <style>{`
        .status-cards {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.65rem;
        }
        .card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 0.65rem 0.85rem;
        }
        .card.wide {
          grid-column: 1 / -1;
        }
        .card-k {
          display: block;
          font-size: 0.68rem;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }
        .card-v {
          font-size: 0.82rem;
          line-height: 1.4;
          word-break: break-word;
        }
        .mono {
          font-family: ui-monospace, monospace;
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  );
}
