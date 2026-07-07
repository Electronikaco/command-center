import type { AgentVisualState } from "../../shared/types";

const STEPS: { key: AgentVisualState | "supervisor"; label: string }[] = [
  { key: "supervisor", label: "Cursor" },
  { key: "waiting", label: "Cola" },
  { key: "running", label: "Opus" },
  { key: "done_pending", label: "Review" },
  { key: "git_busy", label: "Git" },
];

function stepActive(state: AgentVisualState, key: string): boolean {
  if (key === "supervisor") {
    return ["waiting", "done_pending", "git_busy"].includes(state);
  }
  if (key === "waiting") return state === "waiting";
  if (key === "running") return state === "running";
  if (key === "done_pending") return state === "done_pending";
  if (key === "git_busy") return state === "git_busy";
  return false;
}

export function PipelineFlow({ state }: { state: AgentVisualState }) {
  return (
    <div className="panel pipeline">
      <h2>Pipeline</h2>
      <div className="flow">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flow-step-wrap">
            <div
              className={`flow-step ${stepActive(state, s.key) ? "on" : ""} ${state === "error" && s.key === "running" ? "err" : ""}`}
            >
              {s.label}
            </div>
            {i < STEPS.length - 1 && <div className="flow-arrow">→</div>}
          </div>
        ))}
      </div>
      <style>{`
        .pipeline h2 { margin: 0 0 0.75rem; font-size: 0.9rem; }
        .flow {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.25rem;
        }
        .flow-step-wrap { display: flex; align-items: center; }
        .flow-step {
          padding: 0.4rem 0.65rem;
          border-radius: 8px;
          font-size: 0.72rem;
          background: #0a0c10;
          border: 1px solid var(--border);
          color: var(--muted);
        }
        .flow-step.on {
          background: #d9775722;
          border-color: var(--accent);
          color: var(--accent);
          font-weight: 600;
        }
        .flow-step.err {
          background: #ff6b6b22;
          border-color: var(--err);
          color: var(--err);
        }
        .flow-arrow {
          color: var(--border);
          font-size: 0.8rem;
          margin: 0 0.15rem;
        }
      `}</style>
    </div>
  );
}
