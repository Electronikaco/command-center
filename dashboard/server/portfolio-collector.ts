import type {
  PortfolioSnapshot,
  PortfolioSummary,
  ProjectSnapshot,
} from "../shared/types.js";
import { collectGithubProject } from "./github-collector.js";
import { loadRegistry } from "./registry.js";

function buildSummary(projects: ProjectSnapshot[]): PortfolioSummary {
  return {
    totalProjects: projects.length,
    healthy: projects.filter((p) => p.health === "ok").length,
    degraded: projects.filter((p) => p.health === "degraded").length,
    error: projects.filter((p) => p.health === "error").length,
    totalOpenPrs: projects.reduce((s, p) => s + p.openPrs, 0),
  };
}

export function collectPortfolio(registryPath?: string): PortfolioSnapshot {
  const projects = loadRegistry(registryPath);
  const snapshots: ProjectSnapshot[] = projects.map((project) =>
    collectGithubProject(project),
  );

  return {
    generatedAt: new Date().toISOString(),
    projects: snapshots,
    summary: buildSummary(snapshots),
  };
}

export function collectProjectById(id: string): ProjectSnapshot | null {
  const project = loadRegistry().find((p) => p.id === id);
  if (!project) return null;
  return collectGithubProject(project);
}

const isMain =
  typeof process.argv[1] === "string" &&
  process.argv[1].includes("portfolio-collector");

if (isMain) {
  console.log(JSON.stringify(collectPortfolio(), null, 2));
}
