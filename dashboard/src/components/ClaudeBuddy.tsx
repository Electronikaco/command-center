import type { ClaudeBuddy as BuddyType } from "../../shared/types";
import { StatusBadge } from "./StatusBadge";

// Mascota oficial de Claude Code, dibujada como grilla de píxeles.
const MASCOT_ROWS = [
  "..XXXXXX..",
  ".XXXXXXXX.",
  "XXXXXXXXXX",
  "XXXXXXXXXX",
  ".XXXXXXXX.",
  ".XX.XX.XX.",
  ".XX.XX.XX.",
  ".XX.XX.XX.",
];
const EYE_COLS = [3, 6];
const EYE_ROW_START = 1;
const EYE_ROW_SPAN = 2;
const CELL = 10;

function PixelMascot() {
  const width = MASCOT_ROWS[0].length * CELL;
  const height = MASCOT_ROWS.length * CELL;
  return (
    <svg
      className="buddy-art"
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Claude Code"
    >
      {MASCOT_ROWS.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "X" ? (
            <rect
              key={`${x}-${y}`}
              x={x * CELL}
              y={y * CELL}
              width={CELL}
              height={CELL}
              fill="currentColor"
            />
          ) : null,
        ),
      )}
      {EYE_COLS.map((x) => (
        <rect
          key={`eye-${x}`}
          x={x * CELL}
          y={EYE_ROW_START * CELL}
          width={CELL}
          height={EYE_ROW_SPAN * CELL}
          fill="#151820"
        />
      ))}
    </svg>
  );
}

interface Props {
  buddy: BuddyType;
}

export function ClaudeBuddy({ buddy }: Props) {
  return (
    <div className={`buddy buddy-${buddy.mood}`}>
      <div className="buddy-header">
        <span className="buddy-name">{buddy.name}</span>
        <span className={`buddy-rarity rarity-${buddy.rarity.toLowerCase()}`}>
          {buddy.rarity}
        </span>
      </div>

      <PixelMascot />

      <div className="buddy-status-wrap">
        <StatusBadge
          label={buddy.statusBadge.label}
          variant={buddy.statusBadge.variant}
          pulse={buddy.mood === "working" || buddy.mood === "waiting"}
        />
      </div>

      <div className="buddy-stats">
        {buddy.stats.map((s) => (
          <div key={s.key} className="stat-row">
            <span className="stat-key">{s.key}</span>
            <div className="stat-bar">
              <div className="stat-fill" style={{ width: `${s.value}%` }} />
            </div>
            <span className="stat-val">{s.value}</span>
          </div>
        ))}
      </div>

      <style>{`
        .buddy {
          background: linear-gradient(160deg, #1e2230 0%, #151820 100%);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 1rem 1.1rem;
          display: flex;
          flex-direction: column;
          min-height: 100%;
        }
        .buddy-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .buddy-name {
          font-weight: 700;
          font-size: 1rem;
          color: var(--accent);
        }
        .buddy-rarity {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
        }
        .rarity-epic {
          background: #a855f733;
          color: #c084fc;
        }
        .buddy-art {
          display: block;
          width: 88px;
          height: auto;
          margin: 0.25rem auto;
          color: var(--accent);
        }
        .buddy-status-wrap {
          display: flex;
          justify-content: center;
          margin: 0.5rem 0 0.85rem;
        }
        .buddy-stats {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .stat-row {
          display: grid;
          grid-template-columns: 72px 1fr 28px;
          align-items: center;
          gap: 0.4rem;
        }
        .stat-key {
          font-size: 0.58rem;
          color: var(--muted);
          letter-spacing: 0.03em;
        }
        .stat-bar {
          height: 6px;
          background: #0a0c10;
          border-radius: 3px;
          overflow: hidden;
        }
        .stat-fill {
          height: 100%;
          background: linear-gradient(90deg, #d97757, #e8956f);
          border-radius: 3px;
          transition: width 0.6s ease;
        }
        .stat-val {
          font-size: 0.62rem;
          color: var(--muted);
          text-align: right;
        }

        .buddy-working .buddy-art { animation: bob 1.2s ease-in-out infinite; }
        .buddy-waiting .buddy-art { opacity: 0.7; animation: breathe 2.5s ease infinite; }
        .buddy-error .buddy-art { color: var(--err); animation: shake 0.4s infinite; }
        .buddy-celebrating .buddy-art { animation: bounce 0.8s ease infinite; }
        .buddy-git .buddy-art { animation: spin-slow 4s linear infinite; }

        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes shake {
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes spin-slow {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
