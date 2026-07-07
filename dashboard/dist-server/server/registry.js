import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REGISTRY = path.join(__dirname, "../projects.registry.yaml");
function parseScalar(raw) {
    const v = raw.trim();
    if (v === "true")
        return true;
    if (v === "false")
        return false;
    if (/^\d+$/.test(v))
        return Number(v);
    if ((v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))) {
        return v.slice(1, -1);
    }
    return v;
}
/** Minimal YAML loader for our flat registry format (no external deps). */
function parseRegistryYaml(content) {
    const projects = [];
    let current = null;
    let section = [];
    const flushSection = () => {
        if (!current || section.length === 0)
            return;
        const [head, ...rest] = section;
        const key = head.replace(/:$/, "");
        const obj = {};
        for (const line of rest) {
            const m = line.match(/^\s{4,}(\w+):\s*(.+)$/);
            if (m)
                obj[m[1]] = String(parseScalar(m[2]));
        }
        if (key === "progress")
            current.progress = obj;
        else if (key === "health")
            current.health = obj;
        else if (key === "labels")
            current.labels = obj;
        else if (key === "links")
            current.links = obj;
        section = [];
    };
    for (const line of content.split("\n")) {
        if (line.match(/^projects:\s*$/))
            continue;
        const item = line.match(/^  - id:\s*(.+)$/);
        if (item) {
            flushSection();
            if (current)
                projects.push(current);
            current = { id: String(parseScalar(item[1])), name: "", org: "", ghRepo: "", type: "github" };
            continue;
        }
        if (!current)
            continue;
        const nested = line.match(/^    (\w+):\s*$/);
        if (nested) {
            flushSection();
            section = [nested[1] + ":"];
            continue;
        }
        if (section.length > 0 && line.match(/^\s{4,}\w+:/)) {
            section.push(line);
            continue;
        }
        flushSection();
        const kv = line.match(/^    (\w+):\s*(.+)$/);
        if (kv) {
            const k = kv[1];
            const v = parseScalar(kv[2]);
            current[k] = v;
        }
    }
    flushSection();
    if (current)
        projects.push(current);
    return projects;
}
export function loadRegistry(registryPath = process.env.PROJECTS_REGISTRY ?? DEFAULT_REGISTRY) {
    const content = fs.readFileSync(registryPath, "utf8");
    return parseRegistryYaml(content);
}
export function getProjectById(id, registryPath) {
    return loadRegistry(registryPath).find((p) => p.id === id);
}
