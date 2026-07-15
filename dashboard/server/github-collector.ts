import type {
  HealthLevel,
  IssueBreakdown,
  ProgressMeter,
  ProjectProgress,
  ProjectSnapshot,
  RegistryProject,
} from "../shared/types.js";
import { daysAgo, formatRelative, ghApiJson, ghJson, isoAfter } from "./gh-utils.js";

const BREAKDOWN_CAP = 50;

interface RepoMeta {
  pushed_at: string;
  open_issues_count: number;
  default_branch: string;
}

interface Milestone {
  title: string;
  state: string;
  open_issues: number;
  closed_issues: number;
  updated_at: string;
}

interface PrItem {
  number: number;
  title: string;
  updatedAt: string;
  mergedAt?: string;
  isDraft?: boolean;
}

interface CommitItem {
  commit: { author: { date: string } };
}

interface IssueItem {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  state: string;
  labels: { name: string }[];
}

function countCommitsInWindow(
  ghRepo: string,
  branch: string,
  since: Date,
): number {
  try {
    const commits = ghApiJson<CommitItem[]>(
      `repos/${ghRepo}/commits?sha=${encodeURIComponent(branch)}&per_page=100`,
    );
    const pred = isoAfter(since);
    return commits.filter((c) => pred(c.commit.author.date)).length;
  } catch {
    return 0;
  }
}

function fetchMilestones(ghRepo: string): Milestone[] {
  try {
    return ghApiJson<Milestone[]>(`repos/${ghRepo}/milestones?state=all&per_page=20`);
  } catch {
    return [];
  }
}

function fetchIssues(ghRepo: string, label?: string): IssueItem[] {
  try {
    const labelPart = label ? `--label "${label}" ` : "";
    return ghJson<IssueItem[]>(
      `issue list --repo ${ghRepo} ${labelPart}--state all --limit 200 --json number,title,url,updatedAt,state,labels`,
    );
  } catch {
    return [];
  }
}

function fetchMilestoneIssues(ghRepo: string, milestoneTitle: string): IssueItem[] {
  try {
    return ghJson<IssueItem[]>(
      `issue list --repo ${ghRepo} --milestone "${milestoneTitle}" --state all --limit 200 --json number,title,url,updatedAt,state,labels`,
    );
  } catch {
    return [];
  }
}

function buildIssueBreakdown(label: string, items: IssueItem[]): IssueBreakdown {
  const sorted = [...items].sort((a, b) => {
    if (a.state !== b.state) return a.state === "OPEN" ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  return {
    label,
    totalIssues: items.length,
    closedIssues: items.filter((i) => i.state === "CLOSED").length,
    issues: sorted.slice(0, BREAKDOWN_CAP).map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state as "OPEN" | "CLOSED",
      url: i.url,
      updatedAt: i.updatedAt,
    })),
    truncated: items.length > BREAKDOWN_CAP,
  };
}

/**
 * La "épica activa" es el milestone abierto con trabajo pendiente real
 * (open_issues > 0), no el de mayor % completado — un milestone puede
 * quedar "open" en GitHub mucho después de que todas sus issues se cerraron.
 */
function selectActiveMilestone(
  milestones: Milestone[],
  showActivePhase: boolean,
): Milestone | null {
  if (!showActivePhase) return null;
  const withPendingWork = milestones
    .filter((m) => m.state === "open" && m.open_issues > 0)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return withPendingWork[0] ?? null;
}

function milestoneProgress(
  milestones: Milestone[],
  active: Milestone | null,
): ProjectProgress {
  if (milestones.length === 0) {
    return { percent: null, label: "Sin milestones" };
  }

  if (active) {
    const total = active.open_issues + active.closed_issues;
    if (total > 0) {
      const pct = Math.round((active.closed_issues / total) * 100);
      return {
        percent: pct,
        label: `${active.title}: ${active.closed_issues}/${total}`,
      };
    }
  }

  const totalOpen = milestones.reduce((s, m) => s + m.open_issues, 0);
  const totalClosed = milestones.reduce((s, m) => s + m.closed_issues, 0);
  const total = totalOpen + totalClosed;
  if (total === 0) return { percent: null, label: "Milestones vacíos" };
  if (totalOpen === 0) {
    return {
      percent: 100,
      label: `Sin épica activa · ${totalClosed}/${total} issues cerradas`,
    };
  }
  const pct = Math.round((totalClosed / total) * 100);
  return { percent: pct, label: `${totalClosed}/${total} issues en milestones` };
}

function issuesProgress(issues: IssueItem[]): ProjectProgress {
  if (issues.length === 0) return { percent: null, label: "Sin issues" };
  const closed = issues.filter((i) => i.state === "CLOSED").length;
  const pct = Math.round((closed / issues.length) * 100);
  return { percent: pct, label: `${closed}/${issues.length} issues` };
}

function activityProgress(
  commits7d: number,
  commits30d: number,
  trackBranch?: string,
): ProjectProgress {
  const branchNote = trackBranch ? ` (${trackBranch})` : "";
  return {
    percent: null,
    label: `${commits7d} commits / 7d${branchNote}`,
  };
}

function deriveHealth(opts: {
  lastActivityAt: string | null;
  openPrs: PrItem[];
  inactiveDays: number;
  stalePrDays: number;
  collectorError?: string;
}): { health: HealthLevel; reason?: string; highlights: string[] } {
  const highlights: string[] = [];

  if (opts.collectorError) {
    return { health: "error", reason: opts.collectorError, highlights };
  }

  if (opts.lastActivityAt) {
    const inactiveMs = Date.now() - new Date(opts.lastActivityAt).getTime();
    const inactiveLimit = opts.inactiveDays * 86_400_000;
    if (inactiveMs > inactiveLimit) {
      highlights.push(
        `Sin actividad ${formatRelative(opts.lastActivityAt)} (umbral ${opts.inactiveDays}d)`,
      );
      return {
        health: "degraded",
        reason: `Inactivo >${opts.inactiveDays}d`,
        highlights,
      };
    }
  }

  const staleLimit = opts.stalePrDays * 86_400_000;
  const now = Date.now();
  const stalePrs = opts.openPrs.filter((pr) => {
    const age = now - new Date(pr.updatedAt).getTime();
    return age > staleLimit && !pr.isDraft;
  });
  if (stalePrs.length > 0) {
    highlights.push(`${stalePrs.length} PR(s) estancado(s) >${opts.stalePrDays}d`);
    return {
      health: "degraded",
      reason: "PRs estancados",
      highlights,
    };
  }

  return { health: "ok", highlights };
}

export function collectGithubProject(project: RegistryProject): ProjectSnapshot {
  const ghRepo = project.ghRepo;
  const inactiveDays = project.health?.inactiveDays ?? 14;
  const stalePrDays = project.health?.stalePrDays ?? 7;
  const branch = project.trackBranch ?? project.baseBranch ?? "main";

  let meta: RepoMeta | null = null;
  let collectorError: string | undefined;

  try {
    meta = ghApiJson<RepoMeta>(`repos/${ghRepo}`);
  } catch (err) {
    collectorError = err instanceof Error ? err.message : "Error al leer repo";
  }

  let openPrs: PrItem[] = [];
  let mergedPrs30d = 0;
  let commits7d = 0;
  let commits30d = 0;
  let lastActivityAt: string | null = meta?.pushed_at ?? null;

  if (!collectorError) {
    try {
      openPrs = ghJson<PrItem[]>(
        `pr list --repo ${ghRepo} --state open --json number,title,updatedAt,isDraft`,
      );
    } catch {
      /* ignore */
    }

    try {
      const merged = ghJson<PrItem[]>(
        `pr list --repo ${ghRepo} --state merged --limit 50 --json mergedAt`,
      );
      const since30 = daysAgo(30);
      const pred = isoAfter(since30);
      mergedPrs30d = merged.filter((p) => p.mergedAt && pred(p.mergedAt)).length;
    } catch {
      /* ignore */
    }

    commits7d = countCommitsInWindow(ghRepo, branch, daysAgo(7));
    commits30d = countCommitsInWindow(ghRepo, branch, daysAgo(30));

    try {
      const recentCommits = ghApiJson<CommitItem[]>(
        `repos/${ghRepo}/commits?sha=${encodeURIComponent(branch)}&per_page=1`,
      );
      const commitDate = recentCommits[0]?.commit?.author?.date;
      if (commitDate) {
        const commitTime = new Date(commitDate).getTime();
        const pushTime = meta?.pushed_at ? new Date(meta.pushed_at).getTime() : 0;
        lastActivityAt =
          commitTime > pushTime ? commitDate : (meta?.pushed_at ?? commitDate);
      }
    } catch {
      /* use pushed_at */
    }

    if (mergedPrs30d > 0 && lastActivityAt) {
      try {
        const recentMerged = ghJson<PrItem[]>(
          `pr list --repo ${ghRepo} --state merged --limit 1 --json mergedAt`,
        );
        const mergedAt = recentMerged[0]?.mergedAt;
        if (mergedAt && new Date(mergedAt) > new Date(lastActivityAt)) {
          lastActivityAt = mergedAt;
        }
      } catch {
        /* keep commit/push date */
      }
    }
  }

  const mode = project.progress?.mode ?? "activity";
  let progress: ProjectProgress = { percent: null, label: "—" };
  const highlights: string[] = [];
  const progressMeters: ProgressMeter[] = [];
  let issueBreakdown: IssueBreakdown | null = null;

  if (!collectorError) {
    switch (mode) {
      case "milestones": {
        const milestones = fetchMilestones(ghRepo);
        const active = selectActiveMilestone(
          milestones,
          project.progress?.showActivePhase ?? false,
        );
        progress = milestoneProgress(milestones, active);
        if (active) {
          const activeIssues = fetchMilestoneIssues(ghRepo, active.title);
          if (activeIssues.length > 0) {
            issueBreakdown = buildIssueBreakdown(active.title, activeIssues);
          }
          const activeTotal = active.open_issues + active.closed_issues;
          if (activeTotal > 0) {
            progressMeters.push({
              label: "Épica activa",
              closed: active.closed_issues,
              total: activeTotal,
            });
          }
        }
        if (project.labels?.epic) {
          const epics = fetchIssues(ghRepo, project.labels.epic);
          const closed = epics.filter((i) => i.state === "CLOSED").length;
          if (epics.length > 0) {
            progressMeters.push({ label: "Épicas", closed, total: epics.length });
          }
        }
        const globalIssues = fetchIssues(ghRepo);
        const gClosed = globalIssues.filter((i) => i.state === "CLOSED").length;
        if (globalIssues.length > 0) {
          progressMeters.push({
            label: "Global",
            closed: gClosed,
            total: globalIssues.length,
          });
        }
        break;
      }
      case "issues": {
        const label = project.progress?.issueLabel;
        const issues = fetchIssues(ghRepo, label);
        progress = issuesProgress(issues);
        if (issues.length > 0) {
          issueBreakdown = buildIssueBreakdown(label ?? "Issues", issues);
          const closed = issues.filter((i) => i.state === "CLOSED").length;
          progressMeters.push({
            label: label ? `Issues (${label})` : "Issues",
            closed,
            total: issues.length,
          });
        }
        if (project.labels?.epic) {
          const epics = fetchIssues(ghRepo, project.labels.epic);
          const closed = epics.filter((i) => i.state === "CLOSED").length;
          if (epics.length > 0) {
            progressMeters.push({ label: "Épicas", closed, total: epics.length });
          }
        }
        if (label) {
          // "Issues" ya arriba mide todo el repo cuando no hay label — un
          // meter "Global" aparte solo aporta cuando el principal es un subset.
          const globalIssues = fetchIssues(ghRepo);
          const gClosed = globalIssues.filter((i) => i.state === "CLOSED").length;
          if (globalIssues.length > 0) {
            progressMeters.push({
              label: "Global",
              closed: gClosed,
              total: globalIssues.length,
            });
          }
        }
        break;
      }
      case "activity":
      case "none":
      default:
        progress = activityProgress(commits7d, commits30d, project.trackBranch);
        if (commits30d > 0 && commits7d === 0) {
          highlights.push("Sin commits en los últimos 7 días");
        }
        break;
    }
  }

  const healthResult = deriveHealth({
    lastActivityAt,
    openPrs,
    inactiveDays,
    stalePrDays,
    collectorError,
  });

  return {
    id: project.id,
    name: project.name,
    org: project.org,
    ghRepo,
    type: "github",
    description: project.description,
    health: healthResult.health,
    healthReason: healthResult.reason,
    openPrs: openPrs.length,
    mergedPrs30d,
    commits7d,
    commits30d,
    lastActivityAt,
    progress,
    progressMeters,
    highlights: [...healthResult.highlights, ...highlights],
    issueBreakdown,
    links: project.links,
  };
}
