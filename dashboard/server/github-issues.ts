import { ghJson } from "./gh-utils.js";

export interface GhIssueRow {
  number: number;
  title: string;
  state: string;
  labels: { name: string }[];
  url: string;
}

export function fetchOpenIssues(ghRepo: string): GhIssueRow[] {
  try {
    return ghJson<GhIssueRow[]>(
      `issue list --repo ${ghRepo} --state open --limit 100 --json number,title,state,labels,url`,
    );
  } catch {
    return [];
  }
}

/** Mapea código de UC/GATE → número de issue desde el markdown de épica.
 * Solo enlaces en la misma línea (evita falsos positivos tipo CONFIG-01 → #160).
 */
export function parseUcIssueMap(content: string): Map<string, number> {
  const map = new Map<string, number>();
  const re =
    /(UC-DM-(?:S[0-9]+|INFRA|CONFIG)-[0-9]+|GATE-[0-9]+)(?:(?!UC-DM-|GATE-)[^\n]){0,160}?\[#(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    map.set(m[1], Number(m[2]));
  }
  return map;
}

/**
 * UC completada si:
 * - la issue vinculada está cerrada, o
 * - hay PR mergeado con el código (aunque la issue siga abierta por higiene), o
 * - no hay issue mapeada y hay PR mergeado.
 */
export function ucIsDone(opts: {
  code: string;
  issueNum: number | undefined;
  openIssueNums: Set<number>;
  mergedHeads: string[];
}): boolean {
  const prDone = opts.mergedHeads.some((h) => h.includes(opts.code));
  if (opts.issueNum === undefined) {
    return prDone;
  }
  if (!opts.openIssueNums.has(opts.issueNum)) {
    return true;
  }
  return prDone;
}
