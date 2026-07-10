import type { EpicProgressItem } from "../../shared/types";

const STATUS_COLOR: Record<string, string> = {
  done: "#3ecf8e",
  active: "#d97757",
  pending: "#2a2f3d",
};

const PHASE1_EPICS = new Set(["A", "B", "C", "D", "E", "F", "G", "I"]);
const PHASE2_EPICS = new Set(["J"]); // Bloque 2 · EPIC-J + contratos INFRA + gate
const PHASE25_EPICS = new Set(["K"]); // Bloque 2.5 · EPIC-K config/planes SaaS

function splitByPhase(epics: EpicProgressItem[]) {
  const phase1 = epics.filter((e) => PHASE1_EPICS.has(e.letter));
  const phase2 = epics.filter((e) => PHASE2_EPICS.has(e.letter));
  const phase25 = epics.filter((e) => PHASE25_EPICS.has(e.letter));
  const other = epics.filter(
    (e) =>
      !PHASE1_EPICS.has(e.letter) &&
      !PHASE2_EPICS.has(e.letter) &&
      !PHASE25_EPICS.has(e.letter),
  );

  const phases = [
    { key: "phase1", title: "Fase 1 · MVP funcional", epics: phase1 },
    { key: "phase2", title: "Fase 2 · Consolidación pre-backend", epics: phase2 },
    {
      key: "phase25",
      title: "Bloque 2.5 · Configuración + Planes SaaS",
      epics: phase25,
    },
  ];
  if (other.length) {
    phases.push({ key: "other", title: "Otros hitos", epics: other });
  }
  return phases.filter((p) => p.epics.length > 0);
}

function getPhaseSummary(epics: EpicProgressItem[]) {
  const totalUcs = epics.reduce((acc, e) => acc + e.totalUcs, 0);
  const doneUcs = epics.reduce((acc, e) => acc + e.doneUcs, 0);
  const doneEpics = epics.filter((e) => e.status === "done").length;
  const percent = totalUcs ? Math.round((doneUcs / totalUcs) * 100) : 0;

  return { totalUcs, doneUcs, doneEpics, totalEpics: epics.length, percent };
}

export function ProgramChart({ epics, percent }: { epics: EpicProgressItem[]; percent: number }) {
  const phases = splitByPhase(epics);

  return (
    <div className="program-chart panel">
      <div className="chart-head">
        <h2>Avance del programa</h2>
        <span className="big-pct">{percent}%</span>
      </div>

      <div className="phase-sections">
        {phases.map((phase) => {
          const summary = getPhaseSummary(phase.epics);
          return (
            <div key={phase.key} className="phase-block">
              <div className="phase-head">
                <h3>{phase.title}</h3>
                <span>
                  {summary.doneEpics}/{summary.totalEpics} hitos cerrados · {summary.percent}%
                </span>
              </div>

              <div className="stacked-bar">
                {phase.epics.map((e) => {
                  const width = phase.epics.length ? 100 / phase.epics.length : 0;
                  const fill = e.totalUcs ? (e.doneUcs / e.totalUcs) * 100 : 0;
                  return (
                    <div
                      key={e.branch}
                      className={`seg seg-${e.status}`}
                      style={{ width: `${width}%` }}
                      title={`${e.letter}: ${e.doneUcs}/${e.totalUcs} (${e.label})`}
                    >
                      <div className="seg-fill" style={{ height: `${fill}%` }} />
                      <span className="seg-letter">{e.letter}</span>
                    </div>
                  );
                })}
              </div>

              <div className="legend">
                {phase.epics.map((e) => (
                  <div key={e.branch} className="legend-item">
                    <span
                      className="dot"
                      style={{ background: STATUS_COLOR[e.status] }}
                    />
                    <span className="leg-letter">{e.letter}</span>
                    <span className="leg-pct">{e.percent}%</span>
                    <span className="leg-name">{e.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .program-chart { flex: 1; }
        .chart-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 1rem;
        }
        .chart-head h2 {
          margin: 0;
          font-size: 0.95rem;
        }
        .big-pct {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent);
        }
        .phase-sections {
          display: grid;
          gap: 1rem;
        }
        .phase-block {
          border: 1px solid var(--border);
          border-radius: 10px;
          background: #0a0c10;
          padding: 0.7rem;
        }
        .phase-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.55rem;
          gap: 0.7rem;
        }
        .phase-head h3 {
          margin: 0;
          font-size: 0.76rem;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .phase-head span {
          font-size: 0.72rem;
          color: var(--muted);
          white-space: nowrap;
        }
        .stacked-bar {
          display: flex;
          height: 92px;
          gap: 3px;
          margin-bottom: 0.65rem;
        }
        .seg {
          position: relative;
          background: #05070c;
          border-radius: 6px 6px 4px 4px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          overflow: hidden;
          border: 1px solid var(--border);
        }
        .seg-active { border-color: var(--accent); }
        .seg-done { border-color: var(--ok); }
        .seg-fill {
          background: linear-gradient(0deg, var(--accent), #e8956f);
          transition: height 0.5s ease;
        }
        .seg-done .seg-fill {
          background: linear-gradient(0deg, var(--ok), #5ee0a8);
        }
        .seg-letter {
          position: absolute;
          bottom: 4px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text);
        }
        .legend {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.35rem 0.5rem;
        }
        @media (max-width: 900px) {
          .legend { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 700px) {
          .legend { grid-template-columns: 1fr; }
          .phase-head {
            align-items: flex-start;
            flex-direction: column;
          }
        }
        .legend-item {
          display: grid;
          grid-template-columns: 8px 16px 32px 1fr;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.68rem;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .leg-letter { font-weight: 700; }
        .leg-pct { color: var(--muted); }
        .leg-name {
          color: var(--muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
}
