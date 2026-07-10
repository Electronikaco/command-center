import type { OrchestratorSnapshot } from "../../shared/types";

const SYSTEM_HEALTH: Record<string, string> = {
  ok: "Operativo",
  degraded: "Revisar",
  error: "Requiere acción",
};

function formatAge(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  return `${Math.floor(sec / 3600)} h`;
}

function cronSummary(data: OrchestratorSnapshot): {
  text: string;
  ok: boolean;
} {
  const sup = data.cron.supervisor;
  const opus = data.cron.opusWorker;
  const ok = sup.healthy && opus.healthy;
  if (ok) return { text: "Al día", ok: true };
  const parts: string[] = [];
  if (!sup.healthy) parts.push(`Git ${sup.label ?? "retrasado"}`);
  if (!opus.healthy) parts.push(`Opus ${opus.label ?? "retrasado"}`);
  return { text: parts.join(" · "), ok: false };
}

function activityLabel(data: OrchestratorSnapshot): string {
  if (data.agent.state === "running") return data.agent.label;
  if (data.queue.nextUc) return data.queue.nextUc;
  return data.orchestrator.currentUc ?? data.agent.label;
}

function activitySub(data: OrchestratorSnapshot): string {
  const map: Record<string, string> = {
    running: "en curso",
    waiting: "en cola",
    idle: "al día",
    error: "bloqueado",
    git_busy: "mergeando",
    done_pending: "pendiente merge",
  };
  const estado = data.orchestrator.estado?.toLowerCase() ?? "";
  return map[data.agent.state] ?? (estado || "—");
}

export function KpiStrip({ data }: { data: OrchestratorSnapshot }) {
  const active = data.program.activeEpic;
  const crons = cronSummary(data);

  return (
    <div className="kpi-strip">
      <div className="kpi">
        <span className="kpi-val">{data.program.percent}%</span>
        <span className="kpi-label">Programa</span>
        <span className="kpi-sub">
          {data.program.doneUcs}/{data.program.totalUcs} UCs ·{" "}
          {data.program.githubBacklog?.pendingCount ?? 0} issues pendientes
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-val">
          {active ? `${active.percent}%` : "—"}
        </span>
        <span className="kpi-label">
          Épica {active?.letter ?? "—"}
        </span>
        <span className="kpi-sub">
          {active
            ? `${active.doneUcs}/${active.totalUcs} UCs`
            : "sin épica activa"}
        </span>
      </div>
      <div className="kpi">
        <span className={`kpi-val state-${data.agent.state}`}>
          {activityLabel(data)}
        </span>
        <span className="kpi-label">Actividad</span>
        <span className="kpi-sub">{activitySub(data)}</span>
      </div>
      <div className="kpi">
        <span className={`kpi-val ${crons.ok ? "ok" : "warn"}`}>
          {crons.text}
        </span>
        <span className="kpi-label">Automatización</span>
        <span className="kpi-sub">
          Git {formatAge(data.cron.supervisor.lastRunAgeSec)} · Opus{" "}
          {formatAge(data.cron.opusWorker.lastRunAgeSec)}
        </span>
      </div>
      <div className={`kpi health-kpi health-${data.health}`}>
        <span className="kpi-val">{SYSTEM_HEALTH[data.health]}</span>
        <span className="kpi-label">Sistema</span>
        <span className="kpi-sub">
          {data.git.openPrs} PRs abiertos · {data.program.githubBacklog?.openCount ?? 0}{" "}
          issues · {data.git.activeBranches} ramas uc/epic
        </span>
      </div>
      <style>{`
        .kpi-strip {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.65rem;
        }
        @media (max-width: 900px) {
          .kpi-strip { grid-template-columns: repeat(2, 1fr); }
        }
        .kpi {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 0.75rem 0.9rem;
        }
        .kpi-val {
          display: block;
          font-size: 1.35rem;
          font-weight: 700;
          line-height: 1.2;
        }
        .kpi-val.ok { color: var(--ok); }
        .kpi-val.warn { color: var(--warn); }
        .kpi-val.state-running { color: var(--ok); font-size: 1rem; }
        .kpi-val.state-error { color: var(--err); font-size: 1rem; }
        .kpi-val.state-waiting { color: var(--warn); font-size: 1rem; }
        .kpi-val.state-idle { color: var(--muted); font-size: 1rem; }
        .kpi-label {
          display: block;
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
          margin-top: 0.2rem;
        }
        .kpi-sub {
          display: block;
          font-size: 0.68rem;
          color: var(--muted);
          margin-top: 0.15rem;
        }
        .health-kpi.health-ok .kpi-val { color: var(--ok); }
        .health-kpi.health-degraded .kpi-val { color: var(--warn); }
        .health-kpi.health-error .kpi-val { color: var(--err); }
      `}</style>
    </div>
  );
}
