import { collect } from "./collector.js";
import { collectGithubProject } from "./github-collector.js";
import { loadRegistry } from "./registry.js";
function summarizeOrchestrator(project, snapshot) {
    const activeEpic = snapshot.program.activeEpic;
    const highlights = [];
    if (snapshot.orchestrator.bloqueos && !/^ninguno/i.test(snapshot.orchestrator.bloqueos)) {
        highlights.push(`Bloqueo: ${snapshot.orchestrator.bloqueos.slice(0, 80)}`);
    }
    if (snapshot.queue.hasNextTask && snapshot.queue.nextUc) {
        highlights.push(`En cola: ${snapshot.queue.nextUc}`);
    }
    if (snapshot.git.openPrs > 0) {
        highlights.push(`${snapshot.git.openPrs} PR(s) abierto(s)`);
    }
    let health = snapshot.health;
    let healthReason;
    if (snapshot.agent.state === "error") {
        health = "error";
        healthReason = snapshot.agent.label;
    }
    else if (snapshot.agent.state === "git_busy") {
        health = "degraded";
        healthReason = "Git en curso";
    }
    const lastEvent = snapshot.timeline[0];
    const lastActivityAt = snapshot.orchestrator.timestamp || lastEvent?.ts || snapshot.generatedAt;
    return {
        id: project.id,
        name: project.name,
        org: project.org,
        ghRepo: project.ghRepo,
        type: "orchestrator",
        description: "Orquestador DosMentes — épicas y UCs",
        health,
        healthReason,
        openPrs: snapshot.git.openPrs,
        mergedPrs30d: 0,
        commits7d: 0,
        commits30d: 0,
        lastActivityAt,
        progress: {
            percent: snapshot.program.percent,
            label: `Programa ${snapshot.program.doneUcs}/${snapshot.program.totalUcs} UCs`,
        },
        highlights,
        detailRoute: project.detailRoute ?? `/project/${project.id}`,
        links: project.links ?? {
            github: `https://github.com/${project.ghRepo}`,
        },
        orchestratorSummary: {
            estado: snapshot.orchestrator.estado,
            currentUc: snapshot.orchestrator.currentUc,
            programPercent: snapshot.program.percent,
            activeEpic: activeEpic
                ? `EPIC-${activeEpic.letter} ${activeEpic.label}`
                : null,
            agentLabel: snapshot.agent.label,
        },
    };
}
function buildSummary(projects) {
    return {
        totalProjects: projects.length,
        healthy: projects.filter((p) => p.health === "ok").length,
        degraded: projects.filter((p) => p.health === "degraded").length,
        error: projects.filter((p) => p.health === "error").length,
        totalOpenPrs: projects.reduce((s, p) => s + p.openPrs, 0),
    };
}
export function collectPortfolio(registryPath, orchestratorSnapshot) {
    const projects = loadRegistry(registryPath);
    const orchSnap = orchestratorSnapshot ?? collect();
    const snapshots = projects.map((project) => {
        if (project.type === "orchestrator") {
            return summarizeOrchestrator(project, orchSnap);
        }
        return collectGithubProject(project);
    });
    return {
        generatedAt: new Date().toISOString(),
        projects: snapshots,
        summary: buildSummary(snapshots),
    };
}
export function collectProjectById(id, orchestratorSnapshot) {
    const project = loadRegistry().find((p) => p.id === id);
    if (!project)
        return null;
    if (project.type === "orchestrator") {
        const snap = orchestratorSnapshot ?? collect();
        return summarizeOrchestrator(project, snap);
    }
    return collectGithubProject(project);
}
const isMain = typeof process.argv[1] === "string" &&
    process.argv[1].includes("portfolio-collector");
if (isMain) {
    console.log(JSON.stringify(collectPortfolio(), null, 2));
}
