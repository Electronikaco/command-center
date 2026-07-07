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

// ── Portfolio multi-proyecto ────────────────────────────────────────────────

export type ProgressMode = "milestones" | "issues" | "prs" | "activity" | "none";
export type ProjectType = "orchestrator" | "github";

export interface RegistryProgress {
  mode: ProgressMode;
  showActivePhase?: boolean;
  activityWindowDays?: number;
  issueLabel?: string;
}

export interface RegistryHealth {
  stalePrDays?: number;
  inactiveDays?: number;
}

export interface RegistryProject {
  id: string;
  name: string;
  org: string;
  ghRepo: string;
  type: ProjectType;
  baseBranch?: string;
  trackBranch?: string;
  description?: string;
  orchDir?: string;
  repoDir?: string;
  detailRoute?: string;
  progress?: RegistryProgress;
  labels?: Record<string, string>;
  health?: RegistryHealth;
  links?: Record<string, string>;
}

export interface ProjectProgress {
  percent: number | null;
  label: string;
}

export interface OrchestratorSummary {
  estado: string;
  currentUc: string | null;
  programPercent: number;
  activeEpic: string | null;
  agentLabel: string;
}

export interface ProjectSnapshot {
  id: string;
  name: string;
  org: string;
  ghRepo: string;
  type: ProjectType;
  description?: string;
  health: HealthLevel;
  healthReason?: string;
  openPrs: number;
  mergedPrs30d: number;
  commits7d: number;
  commits30d: number;
  lastActivityAt: string | null;
  progress: ProjectProgress;
  highlights: string[];
  detailRoute?: string;
  links?: Record<string, string>;
  orchestratorSummary?: OrchestratorSummary;
}

export interface PortfolioSummary {
  totalProjects: number;
  healthy: number;
  degraded: number;
  error: number;
  totalOpenPrs: number;
}

export interface PortfolioSnapshot {
  generatedAt: string;
  projects: ProjectSnapshot[];
  summary: PortfolioSummary;
}
