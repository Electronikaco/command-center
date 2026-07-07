import type { AgentVisualState } from "../../shared/types";

interface Props {
  state: AgentVisualState;
  label: string;
}

/** Marca Claude (estilo Anthropic): asterisco coral con animación por estado. */
export function ClaudeMascot({ state, label }: Props) {
  return (
    <div className={`mascot mascot-${state}`}>
      <div className="mascot-glow" />
      <svg
        className="mascot-svg"
        viewBox="0 0 120 120"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Claude"
      >
        <g className="mascot-rays">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <rect
              key={deg}
              x="56"
              y="18"
              width="8"
              height="28"
              rx="4"
              fill="currentColor"
              transform={`rotate(${deg} 60 60)`}
            />
          ))}
        </g>
        <circle cx="60" cy="60" r="14" fill="currentColor" />
      </svg>
      <p className="mascot-label">{label}</p>
      <span className={`mascot-badge badge-${state}`}>{state}</span>
      <style>{`
        .mascot {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1.25rem 1rem;
          min-height: 200px;
        }
        .mascot-glow {
          position: absolute;
          inset: 20%;
          border-radius: 50%;
          background: var(--accent-glow);
          filter: blur(24px);
          opacity: 0.5;
        }
        .mascot-svg {
          width: 96px;
          height: 96px;
          color: #d97757;
          position: relative;
          z-index: 1;
        }
        .mascot-label {
          margin: 0.75rem 0 0.35rem;
          font-size: 0.85rem;
          text-align: center;
          z-index: 1;
        }
        .mascot-badge {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          z-index: 1;
        }
        .badge-running { background: #3ecf8e33; color: var(--ok); }
        .badge-waiting { background: #f5a62333; color: var(--warn); }
        .badge-idle { background: #8b93a733; color: var(--muted); }
        .badge-error { background: #ff6b6b33; color: var(--err); }
        .badge-git_busy { background: #6b9fff33; color: var(--primary); }
        .badge-done_pending { background: #d9775733; color: var(--accent); }

        .mascot-running .mascot-rays {
          animation: spin 3s linear infinite;
          transform-origin: 60px 60px;
        }
        .mascot-running .mascot-svg {
          animation: pulse 1.5s ease-in-out infinite;
        }
        .mascot-waiting .mascot-svg {
          animation: breathe 2.5s ease-in-out infinite;
          opacity: 0.85;
        }
        .mascot-git_busy .mascot-rays {
          animation: spin 6s linear infinite;
        }
        .mascot-error .mascot-svg {
          color: var(--err);
          animation: shake 0.5s ease-in-out infinite;
        }
        .mascot-done_pending .mascot-svg {
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
      `}</style>
    </div>
  );
}
