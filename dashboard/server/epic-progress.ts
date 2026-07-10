import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  fetchOpenIssues,
  parseUcIssueMap,
  ucIsDone,
  type GhIssueRow,
} from "./github-issues.js";
import type { EpicProgressItem, EpicStatus, ProgramProgress } from "../shared/types.js";

const TRACKER_CODE_RE =
  /(?:UC-DM-(?:S[0-9]+|INFRA|CONFIG)-[0-9]+|GATE-[0-9]+)/g;

export function parseEpicOrder(
  configContent: string,
  repoDir: string,
): { branch: string; doc: string }[] {
  const items: { branch: string; doc: string }[] = [];
  const re = /"(epic\/[^:"]+):([^"]+)"/g;
  let m: RegExpExecArray | null;
  const orchDir =
    process.env.ORCH_DIR ?? "/home/claude/dosmentes/.orchestrator";
  while ((m = re.exec(configContent)) !== null) {
    const relative = m[2];
    const primary = path.join(repoDir, relative);
    const mirror = path.join(orchDir, "backlog-mirror", path.basename(relative));
    const doc = fs.existsSync(primary)
      ? primary
      : fs.existsSync(mirror)
        ? mirror
        : primary;
    items.push({ branch: m[1], doc });
  }
  return items;
}

function readSafe(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/** Contenido canónico del backlog: si la épica ya está en develop, leer de ahí
 * (evita que UCs nuevas en ramas docs/feature inflen o rompan el avance). */
function readEpicDocContent(
  repoDir: string,
  docPath: string,
  baseBranch: string,
  epicFullyMerged: boolean,
): string {
  if (epicFullyMerged) {
    try {
      const rel = path.relative(repoDir, docPath).replace(/\\/g, "/");
      if (rel && !rel.startsWith("..")) {
        const out = execSync(
          `git -C "${repoDir}" show "origin/${baseBranch}:${rel}"`,
          { encoding: "utf8", timeout: 10000 },
        );
        if (out.trim()) return out;
      }
    } catch {
      /* fallback a disco */
    }
  }
  return readSafe(docPath);
}

/**
 * Extrae códigos UC del markdown de épica.
 * Prioridad: (1) sección "Tracker operativo", (2) encabezados `## UC-DM-…`,
 * (3) fallback al documento completo. Excluye INFRA-01 (recurrente por diseño).
 */
function listUcCodesFromContent(content: string): string[] {
  const tracker = content.match(
    /##\s+Tracker operativo[\s\S]*?(?=\n##\s+(?!Tracker)|\n#\s[^#]|$)/i,
  );
  const headers = [
    ...content.matchAll(
      /^##\s+(UC-DM-(?:S[0-9]+|INFRA|CONFIG)-[0-9]+|GATE-[0-9]+)/gm,
    ),
  ].map((m) => m[1]);
  const scope = tracker?.[0] ?? (headers.length ? headers.join("\n") : content);
  const found = scope.match(TRACKER_CODE_RE) ?? [];
  return [...new Set(found)].filter((c) => c !== "UC-DM-INFRA-01");
}

function epicLabel(branch: string, docPath: string): { letter: string; label: string } {
  const letter = branch.match(/epic\/([A-Z])/)?.[1] ?? "?";
  const base = path.basename(docPath, ".md");
  const label = base.replace(/^EPIC-[A-Z]-/, "").replace(/-/g, " ");
  return { letter, label };
}

function fetchMergedHeads(ghRepo: string): string[] {
  try {
    const out = execSync(
      `gh pr list --repo ${ghRepo} --state merged --json headRefName --jq '.[].headRefName'`,
      { encoding: "utf8", timeout: 25000 },
    );
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function fetchMergedEpicsToDevelop(ghRepo: string, baseBranch: string): Set<string> {
  try {
    const out = execSync(
      `gh pr list --repo ${ghRepo} --base ${baseBranch} --state merged --json headRefName --jq '.[].headRefName'`,
      { encoding: "utf8", timeout: 25000 },
    );
    return new Set(out.trim().split("\n").filter((b) => b.startsWith("epic/")));
  } catch {
    return new Set();
  }
}

function buildIssueCodeIndex(
  order: { branch: string; doc: string }[],
  repoDir: string,
  baseBranch: string,
  mergedEpics: Set<string>,
): Map<number, string> {
  const index = new Map<number, string>();
  for (const { branch, doc } of order) {
    const content = readEpicDocContent(
      repoDir,
      doc,
      baseBranch,
      mergedEpics.has(branch),
    );
    for (const [code, num] of parseUcIssueMap(content)) {
      index.set(num, code);
    }
  }
  return index;
}

export function buildProgramProgress(opts: {
  configPath: string;
  repoDir: string;
  ghRepo: string;
  baseBranch: string;
  activeEpicBranch: string | null;
  currentUc: string | null;
}): ProgramProgress {
  const config = readSafe(opts.configPath);
  const order = parseEpicOrder(config, opts.repoDir);
  const mergedHeads = fetchMergedHeads(opts.ghRepo);
  const mergedEpics = fetchMergedEpicsToDevelop(opts.ghRepo, opts.baseBranch);
  const openIssues = fetchOpenIssues(opts.ghRepo);
  const openIssueNums = new Set(openIssues.map((i) => i.number));
  const issueCodeIndex = buildIssueCodeIndex(
    order,
    opts.repoDir,
    opts.baseBranch,
    mergedEpics,
  );

  let activeEpic: EpicProgressItem | null = null;
  const epics: EpicProgressItem[] = order.map(({ branch, doc }) => {
    const epicFullyMerged = mergedEpics.has(branch);
    const content = readEpicDocContent(
      opts.repoDir,
      doc,
      opts.baseBranch,
      epicFullyMerged,
    );
    const codes = listUcCodesFromContent(content);
    const issueMap = parseUcIssueMap(content);
    const { letter, label } = epicLabel(branch, doc);

    const ucs = codes.map((code) => {
      const issueNumber = issueMap.get(code);
      const done =
        ucIsDone({
          code,
          issueNum: issueNumber,
          openIssueNums,
          mergedHeads,
        }) || epicFullyMerged;
      const issueOpen =
        issueNumber !== undefined && openIssueNums.has(issueNumber);
      return {
        code,
        done,
        active:
          !done &&
          branch === opts.activeEpicBranch &&
          code === opts.currentUc,
        issueNumber,
        issueOpen,
        staleIssue: issueOpen && done,
      };
    });

    const doneUcs = ucs.filter((u) => u.done).length;
    const totalUcs = ucs.length;
    const allUcsDone = totalUcs > 0 && doneUcs === totalUcs;
    const percent =
      totalUcs === 0 ? 0 : Math.round((doneUcs / totalUcs) * 100);

    let status: EpicStatus;
    if (allUcsDone || epicFullyMerged) {
      status = "done";
    } else if (doneUcs > 0 || branch === opts.activeEpicBranch) {
      status = "active";
    } else {
      status = "pending";
    }

    return {
      branch,
      letter,
      label,
      totalUcs,
      doneUcs: epicFullyMerged ? totalUcs : doneUcs,
      percent: epicFullyMerged ? 100 : percent,
      status: epicFullyMerged ? ("done" as EpicStatus) : status,
      ucs,
    };
  });

  // Preferir la fase activa del programa (phase25 → K, phase2 → J).
  const programPhase = (readSafe(opts.configPath).match(
    /^PROGRAM_PHASE="([^"]+)"/m,
  )?.[1] ?? "").toLowerCase();
  const phaseLetter =
    programPhase === "phase25" || programPhase === "phase2.5"
      ? "K"
      : programPhase === "phase2"
        ? "J"
        : null;
  const phasePreferred = phaseLetter
    ? epics.find((e) => e.letter === phaseLetter && e.percent < 100)
    : null;

  const explicit = opts.activeEpicBranch
    ? epics.find((e) => e.branch === opts.activeEpicBranch && e.percent < 100)
    : null;
  const partial = epics.find(
    (e) => e.doneUcs > 0 && e.doneUcs < e.totalUcs,
  );
  activeEpic =
    phasePreferred ??
    explicit ??
    partial ??
    epics.find((e) => e.percent < 100) ??
    null;
  if (activeEpic) activeEpic.status = "active";

  const totalUcs = epics.reduce((s, e) => s + e.totalUcs, 0);
  const doneUcs = epics.reduce((s, e) => s + e.doneUcs, 0);

  const trackedOpen = openIssues.filter((i) => issueCodeIndex.has(i.number));
  const staleIssues = trackedOpen.filter((i) => {
    const code = issueCodeIndex.get(i.number)!;
    return ucIsDone({
      code,
      issueNum: i.number,
      openIssueNums,
      mergedHeads,
    });
  });
  const pendingIssues = trackedOpen.filter(
    (i) => !staleIssues.some((s) => s.number === i.number),
  );

  return {
    totalUcs,
    doneUcs,
    percent: totalUcs ? Math.round((doneUcs / totalUcs) * 100) : 0,
    epics,
    activeEpic,
    githubBacklog: buildGithubBacklog(
      openIssues,
      issueCodeIndex,
      pendingIssues,
      staleIssues,
      opts.ghRepo,
    ),
  };
}

function buildGithubBacklog(
  allOpen: GhIssueRow[],
  issueCodeIndex: Map<number, string>,
  pendingIssues: GhIssueRow[],
  staleIssues: GhIssueRow[],
  ghRepo: string,
): ProgramProgress["githubBacklog"] {
  const repoUrl = `https://github.com/${ghRepo}`;
  const mapItem = (i: GhIssueRow, kind: "pending" | "stale" | "other") => ({
    number: i.number,
    title: i.title,
    code: issueCodeIndex.get(i.number) ?? null,
    url: i.url || `${repoUrl}/issues/${i.number}`,
    kind,
  });

  const otherOpen = allOpen.filter((i) => !issueCodeIndex.has(i.number));

  return {
    openCount: allOpen.length,
    trackedOpenCount: pendingIssues.length + staleIssues.length,
    pendingCount: pendingIssues.length,
    staleCount: staleIssues.length,
    items: [
      ...pendingIssues.map((i) => mapItem(i, "pending")),
      ...staleIssues.map((i) => mapItem(i, "stale")),
      ...otherOpen.map((i) => mapItem(i, "other")),
    ],
  };
}
