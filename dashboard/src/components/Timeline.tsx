import type { TimelineEntry } from "../../shared/types";

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="panel timeline">
      <h2>Timeline (log.jsonl)</h2>
      <ul>
        {entries.map((e, i) => (
          <li key={`${e.ts}-${i}`}>
            <time>{e.ts.slice(11, 19)}</time>
            <span className={`agent agent-${e.agent}`}>{e.agent}</span>
            <span className="event">{e.event}</span>
            <span className="msg">{e.msg.slice(0, 120)}</span>
          </li>
        ))}
      </ul>
      <style>{`
        .timeline ul {
          list-style: none;
          margin: 0;
          padding: 0;
          max-height: 320px;
          overflow-y: auto;
          font-size: 0.72rem;
        }
        .timeline li {
          display: grid;
          grid-template-columns: 52px 72px 140px 1fr;
          gap: 0.4rem;
          padding: 0.35rem 0;
          border-bottom: 1px solid var(--border);
          align-items: start;
        }
        time { color: var(--muted); }
        .agent {
          font-weight: 600;
          font-size: 0.68rem;
        }
        .agent-supervisor { color: var(--primary); }
        .agent-opus-worker { color: var(--accent); }
        .event { color: var(--warn); }
        .msg { color: var(--muted); word-break: break-word; }
        @media (max-width: 700px) {
          .timeline li {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
