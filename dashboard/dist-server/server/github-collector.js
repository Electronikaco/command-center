import { daysAgo, formatRelative, ghApiJson, ghJson, isoAfter } from "./gh-utils.js";
function countCommitsInWindow(ghRepo, branch, since) {
    try {
        const commits = ghApiJson(`repos/${ghRepo}/commits?sha=${encodeURIComponent(branch)}&per_page=100`);
        const pred = isoAfter(since);
        return commits.filter((c) => pred(c.commit.author.date)).length;
    }
    catch {
        return 0;
    }
}
function fetchMilestones(ghRepo) {
    try {
        return ghApiJson(`repos/${ghRepo}/milestones?state=all&per_page=20`);
    }
    catch {
        return [];
    }
}
function fetchIssues(ghRepo, label) {
    try {
        const labelArg = label ? ` --label "${label}"` : "";
        return ghJson(`issue list --repo ${ghRepo} --state all --limit 200 --json state,labels${labelArg}`);
    }
    catch {
        return [];
    }
}
function milestoneProgress(milestones, showActivePhase) {
    if (milestones.length === 0) {
        return { percent: null, label: "Sin milestones" };
    }
    if (showActivePhase) {
        const open = milestones
            .filter((m) => m.state === "open")
            .map((m) => ({
            ...m,
            total: m.open_issues + m.closed_issues,
            pct: m.closed_issues / Math.max(m.open_issues + m.closed_issues, 1),
        }))
            .sort((a, b) => b.pct - a.pct);
        const active = open[0];
        if (active && active.total > 0) {
            const pct = Math.round((active.closed_issues / active.total) * 100);
            return {
                percent: pct,
                label: `${active.title}: ${active.closed_issues}/${active.total}`,
            };
        }
    }
    const totalOpen = milestones.reduce((s, m) => s + m.open_issues, 0);
    const totalClosed = milestones.reduce((s, m) => s + m.closed_issues, 0);
    const total = totalOpen + totalClosed;
    if (total === 0)
        return { percent: null, label: "Milestones vacíos" };
    const pct = Math.round((totalClosed / total) * 100);
    return { percent: pct, label: `${totalClosed}/${total} issues en milestones` };
}
function issuesProgress(issues) {
    if (issues.length === 0)
        return { percent: null, label: "Sin issues" };
    const closed = issues.filter((i) => i.state === "CLOSED").length;
    const pct = Math.round((closed / issues.length) * 100);
    return { percent: pct, label: `${closed}/${issues.length} issues` };
}
function activityProgress(commits7d, commits30d, trackBranch) {
    const branchNote = trackBranch ? ` (${trackBranch})` : "";
    return {
        percent: null,
        label: `${commits7d} commits / 7d${branchNote}`,
    };
}
function deriveHealth(opts) {
    const highlights = [];
    if (opts.collectorError) {
        return { health: "error", reason: opts.collectorError, highlights };
    }
    if (opts.lastActivityAt) {
        const inactiveMs = Date.now() - new Date(opts.lastActivityAt).getTime();
        const inactiveLimit = opts.inactiveDays * 86_400_000;
        if (inactiveMs > inactiveLimit) {
            highlights.push(`Sin actividad ${formatRelative(opts.lastActivityAt)} (umbral ${opts.inactiveDays}d)`);
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
export function collectGithubProject(project) {
    const ghRepo = project.ghRepo;
    const inactiveDays = project.health?.inactiveDays ?? 14;
    const stalePrDays = project.health?.stalePrDays ?? 7;
    const branch = project.trackBranch ?? project.baseBranch ?? "main";
    let meta = null;
    let collectorError;
    try {
        meta = ghApiJson(`repos/${ghRepo}`);
    }
    catch (err) {
        collectorError = err instanceof Error ? err.message : "Error al leer repo";
    }
    let openPrs = [];
    let mergedPrs30d = 0;
    let commits7d = 0;
    let commits30d = 0;
    let lastActivityAt = meta?.pushed_at ?? null;
    if (!collectorError) {
        try {
            openPrs = ghJson(`pr list --repo ${ghRepo} --state open --json number,title,updatedAt,isDraft`);
        }
        catch {
            /* ignore */
        }
        try {
            const merged = ghJson(`pr list --repo ${ghRepo} --state merged --limit 50 --json mergedAt`);
            const since30 = daysAgo(30);
            const pred = isoAfter(since30);
            mergedPrs30d = merged.filter((p) => p.mergedAt && pred(p.mergedAt)).length;
        }
        catch {
            /* ignore */
        }
        commits7d = countCommitsInWindow(ghRepo, branch, daysAgo(7));
        commits30d = countCommitsInWindow(ghRepo, branch, daysAgo(30));
        try {
            const recentCommits = ghApiJson(`repos/${ghRepo}/commits?sha=${encodeURIComponent(branch)}&per_page=1`);
            const commitDate = recentCommits[0]?.commit?.author?.date;
            if (commitDate) {
                const commitTime = new Date(commitDate).getTime();
                const pushTime = meta?.pushed_at ? new Date(meta.pushed_at).getTime() : 0;
                lastActivityAt =
                    commitTime > pushTime ? commitDate : (meta?.pushed_at ?? commitDate);
            }
        }
        catch {
            /* use pushed_at */
        }
        if (mergedPrs30d > 0 && lastActivityAt) {
            try {
                const recentMerged = ghJson(`pr list --repo ${ghRepo} --state merged --limit 1 --json mergedAt`);
                const mergedAt = recentMerged[0]?.mergedAt;
                if (mergedAt && new Date(mergedAt) > new Date(lastActivityAt)) {
                    lastActivityAt = mergedAt;
                }
            }
            catch {
                /* keep commit/push date */
            }
        }
    }
    const mode = project.progress?.mode ?? "activity";
    let progress = { percent: null, label: "—" };
    const highlights = [];
    if (!collectorError) {
        switch (mode) {
            case "milestones": {
                const milestones = fetchMilestones(ghRepo);
                progress = milestoneProgress(milestones, project.progress?.showActivePhase ?? false);
                if (project.labels?.epic) {
                    const epics = fetchIssues(ghRepo, project.labels.epic);
                    const closed = epics.filter((i) => i.state === "CLOSED").length;
                    if (epics.length > 0) {
                        highlights.push(`Épicas: ${closed}/${epics.length} cerradas`);
                    }
                }
                const globalIssues = fetchIssues(ghRepo);
                const gClosed = globalIssues.filter((i) => i.state === "CLOSED").length;
                if (globalIssues.length > 0) {
                    highlights.push(`Global: ${gClosed}/${globalIssues.length} issues`);
                }
                break;
            }
            case "issues": {
                const label = project.progress?.issueLabel;
                const issues = fetchIssues(ghRepo, label);
                progress = issuesProgress(issues);
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
        highlights: [...healthResult.highlights, ...highlights],
        links: project.links,
    };
}
