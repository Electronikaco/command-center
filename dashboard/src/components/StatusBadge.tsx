import type { CSSProperties } from "react";

type Variant = "success" | "warning" | "error" | "info" | "active";

const VARIANTS: Record<
  Variant,
  { bg: string; border: string; color: string; glow: string }
> = {
  active: {
    bg: "#d9775720",
    border: "#d97757",
    color: "#f0a88a",
    glow: "#d9775744",
  },
  success: {
    bg: "#3ecf8e20",
    border: "#3ecf8e",
    color: "#7ee8b8",
    glow: "#3ecf8e33",
  },
  warning: {
    bg: "#f5a62320",
    border: "#f5a623",
    color: "#ffc857",
    glow: "#f5a62333",
  },
  error: {
    bg: "#ff6b6b20",
    border: "#ff6b6b",
    color: "#ff9b9b",
    glow: "#ff6b6b44",
  },
  info: {
    bg: "#6b9fff20",
    border: "#6b9fff",
    color: "#9ec0ff",
    glow: "#6b9fff33",
  },
};

interface Props {
  label: string;
  variant: Variant;
  pulse?: boolean;
}

export function StatusBadge({ label, variant, pulse = false }: Props) {
  const v = VARIANTS[variant];
  return (
    <div
      className={`status-badge ${pulse ? "pulse" : ""}`}
      style={
        {
          "--badge-bg": v.bg,
          "--badge-border": v.border,
          "--badge-color": v.color,
          "--badge-glow": v.glow,
        } as CSSProperties
      }
    >
      <span className="status-dot" />
      <span className="status-text">{label}</span>
      <style>{`
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.75rem;
          border-radius: 999px;
          background: var(--badge-bg);
          border: 1.5px solid var(--badge-border);
          color: var(--badge-color);
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          box-shadow: 0 0 12px var(--badge-glow);
          max-width: 100%;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--badge-border);
          flex-shrink: 0;
          box-shadow: 0 0 6px var(--badge-border);
        }
        .status-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .status-badge.pulse .status-dot {
          animation: badge-pulse 1.4s ease-in-out infinite;
        }
        @keyframes badge-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
