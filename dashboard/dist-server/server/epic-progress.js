import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const TRACKER_CODE_RE = /(?:UC-DM-(?:S[0-9]+|INFRA)-[0-9]+|GATE-[0-9]+)/g;
export function parseEpicOrder(configContent, repoDir) {
    const items = [];
    const re = /"(epic\/[^:"]+):([^"]+)"/g;
    let m;
    while ((m = re.exec(configContent)) !== null) {
        items.push({ branch: m[1], doc: path.join(repoDir, m[2]) });
    }
    return items;
}
function readSafe(file) {
    try {
        return fs.readFileSync(file, "utf8");
    }
    catch {
        return "";
    }
}
function listUcCodes(docPath) {
    const content = readSafe(docPath);
    const found = content.match(TRACKER_CODE_RE) ?? [];
    return [...new Set(found)];
}
function epicLabel(branch, docPath) {
    const letter = branch.match(/epic\/([A-Z])/)?.[1] ?? "?";
    const base = path.basename(docPath, ".md");
    const label = base.replace(/^EPIC-[A-Z]-/, "").replace(/-/g, " ");
    return { letter, label };
}
function fetchMergedHeads(ghRepo) {
    try {
        const out = execSync(`gh pr list --repo ${ghRepo} --state merged --json headRefName --jq '.[].headRefName'`, { encoding: "utf8", timeout: 25000 });
        return out.trim().split("\n").filter(Boolean);
    }
    catch {
        return [];
    }
}
function fetchMergedEpicsToDevelop(ghRepo, baseBranch) {
    try {
        const out = execSync(`gh pr list --repo ${ghRepo} --base ${baseBranch} --state merged --json headRefName --jq '.[].headRefName'`, { encoding: "utf8", timeout: 25000 });
        return new Set(out.trim().split("\n").filter((b) => b.startsWith("epic/")));
    }
    catch {
        return new Set();
    }
}
function ucDone(mergedHeads, ucCode) {
    return mergedHeads.some((h) => h.includes(ucCode));
}
export function buildProgramProgress(opts) {
    const config = readSafe(opts.configPath);
    const order = parseEpicOrder(config, opts.repoDir);
    const mergedHeads = fetchMergedHeads(opts.ghRepo);
    const mergedEpics = fetchMergedEpicsToDevelop(opts.ghRepo, opts.baseBranch);
    let activeEpic = null;
    const epics = order.map(({ branch, doc }) => {
        const codes = listUcCodes(doc);
        const { letter, label } = epicLabel(branch, doc);
        const epicFullyMerged = mergedEpics.has(branch);
        const ucs = codes.map((code) => {
            const done = epicFullyMerged || ucDone(mergedHeads, code);
            return {
                code,
                done,
                active: !done &&
                    branch === opts.activeEpicBranch &&
                    code === opts.currentUc,
            };
        });
        const doneUcs = ucs.filter((u) => u.done).length;
        const totalUcs = ucs.length;
        const allUcsDone = totalUcs > 0 && doneUcs === totalUcs;
        const percent = totalUcs === 0 ? 0 : Math.round((doneUcs / totalUcs) * 100);
        let status;
        if (epicFullyMerged || allUcsDone) {
            status = "done";
        }
        else {
            status = "pending";
        }
        return {
            branch,
            letter,
            label,
            totalUcs,
            doneUcs: epicFullyMerged ? totalUcs : doneUcs,
            percent: epicFullyMerged ? 100 : percent,
            status,
            ucs,
        };
    });
    // Primera épica no cerrada = activa; priorizar rama explícita del orquestador
    const explicit = opts.activeEpicBranch
        ? epics.find((e) => e.branch === opts.activeEpicBranch && e.percent < 100)
        : null;
    const partial = epics.find((e) => e.doneUcs > 0 && e.doneUcs < e.totalUcs);
    activeEpic =
        explicit ?? partial ?? epics.find((e) => e.percent < 100) ?? null;
    if (activeEpic)
        activeEpic.status = "active";
    const totalUcs = epics.reduce((s, e) => s + e.totalUcs, 0);
    const doneUcs = epics.reduce((s, e) => s + e.doneUcs, 0);
    return {
        totalUcs,
        doneUcs,
        percent: totalUcs ? Math.round((doneUcs / totalUcs) * 100) : 0,
        epics,
        activeEpic,
    };
}
