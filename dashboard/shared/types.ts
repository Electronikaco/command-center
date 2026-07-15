export type HealthLevel = "ok" | "degraded" | "error";

// ── Portfolio multi-proyecto ────────────────────────────────────────────────

export type ProgressMode = "milestones" | "issues" | "prs" | "activity" | "none";
export type ProjectType = "github";

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
  progress?: RegistryProgress;
  labels?: Record<string, string>;
  health?: RegistryHealth;
  links?: Record<string, string>;
}

export interface ProjectProgress {
  percent: number | null;
  label: string;
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
  links?: Record<string, string>;
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
