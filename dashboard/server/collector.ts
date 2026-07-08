import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildBuddy } from "./buddy.js";
import { buildProgramProgress } from "./epic-progress.js";
import type {
  AgentVisualState,
  HealthLevel,
  OrchestratorSnapshot,
  TimelineEntry,
} from "../shared/types.js";

const ORCH_DIR = process.env.ORCH_DIR ?? "/home/claude/dosmentes/.orchestrator";
const REPO_DIR =
  process.env.REPO_DIR ?? "/home/claude/dosmentes/dosmentes-front";
const GH_REPO = process.env.GH_REPO ?? "electronikatm/dosmentes-front";
const BASE_BRANCH = process.env.BASE_BRANCH ?? "develop";

const PATHS = {
  status: path.join(ORCH_DIR, "status.md"),
  nextTask: path.join(ORCH_DIR, "next-task.md"),
  lock: path.join(ORCH_DIR, "opus.lock"),
  log: path.join(ORCH_DIR, "log.jsonl"),
  cronSupervisor: path.join(ORCH_DIR, "cron-supervisor.log"),
  cronOpus: path.join(ORCH_DIR, "cron-opus.log"),
  config: path.join(ORCH_DIR, "config.sh"),
  statusApi: path.join(ORCH_DIR, "status-api.json"),
};

function readSafe(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function parseStatusField(content: string, field: string): string {
  const re = new RegExp(`^\\*\\*${field}:\\*\\*\\s*(.+)$`, "im");
  const m = content.match(re);
  return m?.[1]?.trim() ?? "";
}

function parseConfigValue(key: string): string {
  const content = readSafe(PATHS.config);
  const m = content.match(new RegExp(`^${key}="([^"]+)"`, "m"));
  return m?.[1] ?? "";
}

function fileAgeSec(file: string): number | null {
  try {
    const st = fs.statSync(file);
    return Math.floor((Date.now() - st.mtimeMs) / 1000);
  } catch {
    return null;
  }
}

function isProcessActive(pattern: string): boolean {
  try {
    execSync(`pgrep -f "${pattern}"`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function readTimeline(limit = 50): TimelineEntry[] {
  const content = readSafe(PATHS.log);
  const lines = content.trim().split("\n").filter(Boolean);
  return lines
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line) as TimelineEntry;
      } catch {
        return null;
      }
    })
    .filter((x): x is TimelineEntry => x !== null)
    .reverse();
}

function lastEventMatching(
  timeline: TimelineEntry[],
  pred: (e: TimelineEntry) => boolean,
): TimelineEntry | null {
  return timeline.find(pred) ?? null;
}

function hasActiveError(
  timeline: TimelineEntry[],
  estado: string,
  bloqueos: string,
): boolean {
  if (/^(blocked|error)/i.test(estado)) return true;
  const b = bloqueos.trim();
  if (b && !/^ninguno/i.test(b)) return true;

  const errEv = timeline.find(
    (e) =>
      e.event === "supervisor_error" ||
      e.event === "supervisor_blocked" ||
      e.event === "opus_error",
  );
  if (!errEv) return false;

  const errTime = new Date(errEv.ts).getTime();
  if (Date.now() - errTime > 30 * 60 * 1000) return false;

  const recoveryEv = timeline.find(
    (e) =>
      new Date(e.ts).getTime() > errTime &&
      (e.event === "supervisor_end" ||
        e.event === "opus_done" ||
        e.event === "opus_start" ||
        e.event.includes("supervisor_pr_merged") ||
        e.event === "supervisor_next_uc" ||
        e.event === "supervisor_auto_queued"),
  );
  return !recoveryEv;
}

function deriveAgentState(
  timeline: TimelineEntry[],
  estado: string,
  bloqueos: string,
  hasNextTask: boolean,
  lockAgeMin: number | null,
  opusActive: boolean,
): { state: AgentVisualState; label: string } {
  const lastOpusStart = lastEventMatching(timeline, (e) => e.event === "opus_start");
  const lastOpusDone = lastEventMatching(timeline, (e) => e.event === "opus_done");
  const estadoProcesado = /^procesado$/i.test(estado);
  const opusWindowOpen =
    !!lastOpusStart &&
    (!lastOpusDone || new Date(lastOpusStart.ts) > new Date(lastOpusDone.ts)) &&
    Date.now() - new Date(lastOpusStart.ts).getTime() < 90 * 60 * 1000;
  const trustOpusWindow = !estadoProcesado || hasNextTask;

  if (
    (lockAgeMin !== null && lockAgeMin < 90) ||
    (opusWindowOpen && trustOpusWindow) ||
    (opusActive && hasNextTask)
  ) {
    return { state: "running", label: "Opus implementando" };
  }

  const gitStart = lastEventMatching(timeline, (e) =>
    e.event.includes("supervisor_git_start"),
  );
  const gitEnd = lastEventMatching(
    timeline,
    (e) =>
      e.event === "supervisor_end" ||
      e.event.includes("supervisor_pr_merged") ||
      e.event.includes("supervisor_error"),
  );
  if (gitStart && (!gitEnd || new Date(gitStart.ts) > new Date(gitEnd.ts))) {
    return { state: "git_busy", label: "Flujo Git" };
  }

  if (hasNextTask) {
    return { state: "waiting", label: "En cola" };
  }

  if (/^done$/i.test(estado)) {
    return { state: "done_pending", label: "Esperando supervisor" };
  }

  if (hasActiveError(timeline, estado, bloqueos)) {
    return { state: "error", label: "Error o bloqueo" };
  }

  if (/^procesado$/i.test(estado)) {
    return { state: "idle", label: "Pipeline al día" };
  }

  return { state: "idle", label: "Inactivo" };
}

/** Último evento en log.jsonl (más fiable que mtime del archivo cron-*.log). */
function lastEventTsInLog(
  agent: string,
  events: string[],
): string | null {
  const content = readSafe(PATHS.log);
  const lines = content.trim().split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const e = JSON.parse(lines[i]) as TimelineEntry;
      if (e.agent !== agent) continue;
      if (events.some((ev) => e.event === ev || e.event.includes(ev))) {
        return e.ts;
      }
    } catch {
      /* skip malformed */
    }
  }
  return null;
}

function cronStatus(
  logFile: string,
  agent: string,
  startEvents: string[],
  scheduleMin: number,
): OrchestratorSnapshot["cron"]["supervisor"] & { label: string } {
  const threshold = scheduleMin * 60 * 2 + 120;
  const lastTs = lastEventTsInLog(agent, startEvents);
  let age: number | null = null;
  let lastRun: string | null = null;

  if (lastTs) {
    age = Math.floor((Date.now() - new Date(lastTs).getTime()) / 1000);
    lastRun = lastTs;
  } else {
    age = fileAgeSec(logFile);
    lastRun =
      age !== null ? new Date(Date.now() - age * 1000).toISOString() : null;
  }

  const healthy = age !== null && age < threshold;
  const label = healthy ? "Al día" : age === null ? "Sin señal" : "Retrasado";

  return {
    schedule: `cada ${scheduleMin} min`,
    lastRun,
    lastRunAgeSec: age,
    healthy,
    label,
  };
}

function lastOpusOutputTail(lines = 5): string[] {
  try {
    const files = fs
      .readdirSync(ORCH_DIR)
      .filter((f) => f.startsWith("opus-output-") && f.endsWith(".log"))
      .map((f) => ({ f, m: fs.statSync(path.join(ORCH_DIR, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    if (files.length === 0) return [];
    return readSafe(path.join(ORCH_DIR, files[0].f))
      .trim()
      .split("\n")
      .slice(-lines);
  } catch {
    return [];
  }
}

function countOpenPrs(): number {
  try {
    const out = execSync(
      `gh pr list --repo ${GH_REPO} --state open --json number --jq 'length'`,
      { encoding: "utf8", timeout: 15000 },
    );
    return Number(out.trim()) || 0;
  } catch {
    return 0;
  }
}

function countActiveBranches(): number {
  try {
    const out = execSync(`git -C "${REPO_DIR}" branch -a 2>/dev/null`, {
      encoding: "utf8",
    });
    return out.split("\n").filter((l) => /^\s*(\*)?\s*(uc|epic)\//.test(l)).length;
  } catch {
    return 0;
  }
}

function extractUc(text: string): string | null {
  const m = text.match(/UC-DM-(?:S[0-9]+|INFRA)-[0-9]+/);
  return m?.[0] ?? null;
}

function deriveHealth(
  cronSup: boolean,
  cronOpus: boolean,
  agentState: AgentVisualState,
): HealthLevel {
  if (agentState === "error") return "error";
  if (!cronSup && !cronOpus) return "error";
  if (!cronSup || !cronOpus) return "degraded";
  return "ok";
}

export function healthLabel(level: HealthLevel): string {
  switch (level) {
    case "ok":
      return "Operativo";
    case "degraded":
      return "Revisar";
    case "error":
      return "Requiere acción";
  }
}

export function collect(): OrchestratorSnapshot {
  const statusContent = readSafe(PATHS.status);
  const estado = parseStatusField(statusContent, "Estado");
  const rama = parseStatusField(statusContent, "Rama");
  const tarea = parseStatusField(statusContent, "Tarea");
  const resumen = parseStatusField(statusContent, "Resumen");
  const bloqueos = parseStatusField(statusContent, "Bloqueos");
  const timestamp = parseStatusField(statusContent, "Timestamp");

  const hasNextTask = fs.existsSync(PATHS.nextTask);
  const nextTaskContent = hasNextTask ? readSafe(PATHS.nextTask) : "";

  let lockAgeMin: number | null = null;
  if (fs.existsSync(PATHS.lock)) {
    const age = fileAgeSec(PATHS.lock);
    lockAgeMin = age !== null ? Math.floor(age / 60) : null;
  }

  const timeline = readTimeline(50);
  const opusActive = isProcessActive("claude --print --model claude-opus-4-8");
  const agentDerived = deriveAgentState(
    timeline,
    estado,
    bloqueos,
    hasNextTask,
    lockAgeMin,
    opusActive,
  );

  const epicMatch = rama.match(/^epic\/[^/]+/) ?? tarea.match(/epic\/[^\s`]+/);
  const activeEpicBranch = epicMatch?.[0] ?? null;
  const nextUc = extractUc(nextTaskContent);
  const currentUc = nextUc ?? (/^procesado$/i.test(estado) ? null : extractUc(tarea) ?? extractUc(rama));

  const program = buildProgramProgress({
    configPath: PATHS.config,
    repoDir: REPO_DIR,
    ghRepo: GH_REPO,
    baseBranch: parseConfigValue("BASE_BRANCH") || BASE_BRANCH,
    activeEpicBranch,
    currentUc,
  });

  const buddy = buildBuddy(agentDerived.state, program.percent, lockAgeMin, {
    estado,
    bloqueos,
    currentUc,
    nextUc,
  });
  const cronSupervisor = cronStatus(
    PATHS.cronSupervisor,
    "supervisor",
    ["supervisor_start"],
    10,
  );
  const cronOpus = cronStatus(
    PATHS.cronOpus,
    "opus-worker",
    ["opus_start", "opus_done", "opus_tick"],
    5,
  );
  if (opusActive) {
    cronOpus.healthy = true;
    cronOpus.label = "En ejecución";
  }

  const snapshot: OrchestratorSnapshot = {
    generatedAt: new Date().toISOString(),
    mode: {
      supervisor: parseConfigValue("SUPERVISOR_AGENT") || "cursor",
      worker: parseConfigValue("WORKER_AGENT") || "opus",
      taskSource: parseConfigValue("TASK_SOURCE") || "backlog",
    },
    cron: {
      supervisor: cronSupervisor,
      opusWorker: cronOpus,
    },
    agent: {
      state: agentDerived.state,
      label: agentDerived.label,
      processActive: opusActive,
      lockActive: fs.existsSync(PATHS.lock),
      lockAgeMin,
      lastOpusStart: timeline.find((e) => e.event === "opus_start")?.ts ?? null,
      lastOpusDone: timeline.find((e) => e.event === "opus_done")?.ts ?? null,
      lastOutputTail: lastOpusOutputTail(),
    },
    buddy,
    program,
    orchestrator: {
      estado,
      rama,
      tarea,
      resumen,
      bloqueos,
      timestamp,
      currentUc,
    },
    queue: {
      hasNextTask,
      nextUc,
    },
    git: {
      openPrs: countOpenPrs(),
      activeBranches: countActiveBranches(),
    },
    timeline,
    health: deriveHealth(
      cronSupervisor.healthy,
      cronOpus.healthy,
      agentDerived.state,
    ),
  };

  fs.writeFileSync(PATHS.statusApi, JSON.stringify(snapshot, null, 2));
  return snapshot;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  console.log(JSON.stringify(collect(), null, 2));
}
