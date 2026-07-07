import type { OrchestratorSnapshot } from "../../shared/types";

function formatAge(sec: number | null): string {
  if (sec === null) return "sin datos";
  if (sec < 60) return `hace ${sec} segundos`;
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} minutos`;
  return `hace ${Math.floor(sec / 3600)} horas`;
}

export function CronHealth({
  cron,
}: {
  cron: OrchestratorSnapshot["cron"];
}) {
  const jobs = [
    {
      name: "Flujo Git",
      desc: "PR, merge y cola de tareas",
      key: "supervisor" as const,
      interval: "cada 10 min",
    },
    {
      name: "Implementación Opus",
      desc: "Recoge next-task y escribe código",
      key: "opusWorker" as const,
      interval: "cada 5 min",
    },
  ];

  return (
    <div className="panel">
      <h2>Automatización (cron)</h2>
      {jobs.map(({ name, desc, key, interval }) => {
        const j = cron[key];
        const status = j.label ?? (j.healthy ? "Al día" : "Retrasado");
        return (
          <div key={key} className="cron-row">
            <div className="cron-head">
              <span className={`dot ${j.healthy ? "ok" : "bad"}`} />
              <div className="cron-titles">
                <strong>{name}</strong>
                <span className="cron-desc">{desc}</span>
              </div>
              <span className={`status-pill ${j.healthy ? "ok" : "bad"}`}>
                {status}
              </span>
            </div>
            <p className="cron-meta">
              Última ejecución: {formatAge(j.lastRunAgeSec)} · {interval}
            </p>
          </div>
        );
      })}
      <style>{`
        .cron-row {
          padding: 0.65rem 0;
          border-bottom: 1px solid var(--border);
        }
        .cron-row:last-child {
          border-bottom: none;
        }
        .cron-head {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
        }
        .cron-titles {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
          min-width: 0;
        }
        .cron-desc {
          font-size: 0.72rem;
          color: var(--muted);
          font-weight: 400;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dot.ok { background: var(--ok); box-shadow: 0 0 6px var(--ok); }
        .dot.bad { background: var(--warn); }
        .status-pill {
          margin-left: auto;
          font-size: 0.68rem;
          padding: 0.15rem 0.45rem;
          border-radius: 999px;
          white-space: nowrap;
        }
        .status-pill.ok {
          background: #3ecf8e22;
          color: var(--ok);
        }
        .status-pill.bad {
          background: #f5a62322;
          color: var(--warn);
        }
        .cron-meta {
          margin: 0.25rem 0 0 1.25rem;
          font-size: 0.72rem;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
