export type AgentVisualState =
  | "running"
  | "waiting"
  | "idle"
  | "error"
  | "git_busy"
  | "done_pending";

export type HealthLevel = "ok" | "degraded" | "error";

export type EpicStatus = "done" | "active" | "pending";

export type BuddyMood =
  | "working"
  | "waiting"
  | "idle"
  | "error"
  | "git"
  | "celebrating";

export interface CronJobStatus {
  schedule: string;
  lastRun: string | null;
  lastRunAgeSec: number | null;
  healthy: boolean;
  label?: string;
}

export interface TimelineEntry {
  ts: string;
  agent: string;
  event: string;
  msg: string;
}

export interface BuddyStat {
  key: "DEBUGGING" | "PATIENCE" | "CHAOS" | "WISDOM" | "SNARK";
  value: number;
}

export interface ClaudeBuddy {
  name: string;
  species: string;
  rarity: string;
  mood: BuddyMood;
  moodLabel: string;
  statusBadge: {
    label: string;
    variant: "success" | "warning" | "error" | "info" | "active";
  };
  stats: BuddyStat[];
}

export interface UcProgress {
  code: string;
  done: boolean;
  active: boolean;
}

export interface EpicProgressItem {
  branch: string;
  letter: string;
  label: string;
  totalUcs: number;
  doneUcs: number;
  percent: number;
  status: EpicStatus;
  ucs: UcProgress[];
}

export interface ProgramProgress {
  totalUcs: number;
  doneUcs: number;
  percent: number;
  epics: EpicProgressItem[];
  activeEpic: EpicProgressItem | null;
}

export interface OrchestratorSnapshot {
  generatedAt: string;
  mode: {
    supervisor: string;
    worker: string;
    taskSource: string;
  };
  cron: {
    supervisor: CronJobStatus;
    opusWorker: CronJobStatus;
  };
  agent: {
    state: AgentVisualState;
    label: string;
    processActive: boolean;
    lockActive: boolean;
    lockAgeMin: number | null;
    lastOpusStart: string | null;
    lastOpusDone: string | null;
    lastOutputTail: string[];
  };
  buddy: ClaudeBuddy;
  program: ProgramProgress;
  orchestrator: {
    estado: string;
    rama: string;
    tarea: string;
    resumen: string;
    bloqueos: string;
    timestamp: string;
    currentUc: string | null;
  };
  queue: {
    hasNextTask: boolean;
    nextUc: string | null;
  };
  git: {
    openPrs: number;
    activeBranches: number;
  };
  timeline: TimelineEntry[];
  health: HealthLevel;
}
