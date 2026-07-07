import type { EpicProgressItem } from "../../shared/types";

export function ActiveEpicPanel({ epic }: { epic: EpicProgressItem | null }) {
  if (!epic) {
    return (
      <div className="panel active-epic empty">
        <h2>Épica activa</h2>
        <p className="muted">Sin épica en curso</p>
      </div>
    );
  }

  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (epic.percent / 100) * c;

  return (
    <div className="panel active-epic">
      <h2>
        Épica {epic.letter} · {epic.label}
      </h2>

      <div className="donut-wrap">
        <svg viewBox="0 0 128 128" className="donut">
          <circle cx="64" cy="64" r={r} className="donut-bg" />
          <circle
            cx="64"
            cy="64"
            r={r}
            className="donut-fg"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
          <text x="64" y="60" textAnchor="middle" className="donut-pct">
            {epic.percent}%
          </text>
          <text x="64" y="78" textAnchor="middle" className="donut-sub">
            {epic.doneUcs}/{epic.totalUcs}
          </text>
        </svg>

        <div className="uc-grid">
          {epic.ucs.map((uc) => (
            <div
              key={uc.code}
              className={`uc-chip ${uc.done ? "done" : ""} ${uc.active ? "active" : ""}`}
              title={uc.code}
            >
              {uc.code.replace("UC-DM-", "")}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .active-epic h2 {
          margin: 0 0 0.75rem;
          font-size: 0.9rem;
          text-transform: capitalize;
        }
        .donut-wrap {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .donut {
          width: 130px;
          height: 130px;
          flex-shrink: 0;
        }
        .donut-bg {
          fill: none;
          stroke: #0a0c10;
          stroke-width: 12;
        }
        .donut-fg {
          fill: none;
          stroke: var(--accent);
          stroke-width: 12;
          stroke-linecap: round;
          transform: rotate(-90deg);
          transform-origin: 64px 64px;
          transition: stroke-dashoffset 0.6s ease;
        }
        .donut-pct {
          fill: var(--text);
          font-size: 22px;
          font-weight: 700;
        }
        .donut-sub {
          fill: var(--muted);
          font-size: 11px;
        }
        .uc-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          flex: 1;
        }
        .uc-chip {
          font-size: 0.62rem;
          padding: 0.25rem 0.45rem;
          border-radius: 6px;
          background: #0a0c10;
          border: 1px solid var(--border);
          color: var(--muted);
          font-family: ui-monospace, monospace;
        }
        .uc-chip.done {
          background: #3ecf8e22;
          border-color: var(--ok);
          color: var(--ok);
        }
        .uc-chip.active {
          background: #d9775722;
          border-color: var(--accent);
          color: var(--accent);
          animation: pulse-chip 1.5s ease infinite;
        }
        @keyframes pulse-chip {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
        .empty .muted { color: var(--muted); font-size: 0.85rem; }
      `}</style>
    </div>
  );
}
