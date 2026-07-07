import { useState } from "react";
import type { TimelineEntry } from "../../shared/types";

export function ActivityFeed({ entries }: { entries: TimelineEntry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="panel activity">
      <button
        type="button"
        className="activity-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "▼" : "▶"} Actividad reciente ({entries.length})
      </button>
      {open && (
        <ul>
          {entries.map((e, i) => (
            <li key={`${e.ts}-${i}`}>
              <time>{e.ts.slice(11, 19)}</time>
              <span className={`ag ag-${e.agent}`}>{e.agent}</span>
              <span className="ev">{e.event}</span>
            </li>
          ))}
        </ul>
      )}
      <style>{`
        .activity { padding: 0.65rem 1rem; }
        .activity-toggle {
          background: none;
          border: none;
          color: var(--muted);
          font-size: 0.78rem;
          cursor: pointer;
          padding: 0;
        }
        .activity ul {
          list-style: none;
          margin: 0.5rem 0 0;
          padding: 0;
          max-height: 160px;
          overflow-y: auto;
        }
        .activity li {
          display: grid;
          grid-template-columns: 52px 90px 1fr;
          gap: 0.5rem;
          font-size: 0.68rem;
          padding: 0.25rem 0;
          border-bottom: 1px solid var(--border);
        }
        time { color: var(--muted); }
        .ag-supervisor { color: var(--primary); }
        .ag-opus-worker { color: var(--accent); }
        .ev { color: var(--muted); }
      `}</style>
    </div>
  );
}
