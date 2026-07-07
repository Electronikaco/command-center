import { execSync } from "node:child_process";
const GH_TIMEOUT_MS = 25_000;
export function ghJson(args) {
    const out = execSync(`gh ${args}`, {
        encoding: "utf8",
        timeout: GH_TIMEOUT_MS,
        stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(out || "null");
}
export function ghApiJson(endpoint) {
    return ghJson(`api ${endpoint}`);
}
export function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}
export function isoAfter(date) {
    return (iso) => new Date(iso) >= date;
}
export function formatRelative(iso) {
    if (!iso)
        return "sin datos";
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 60)
        return mins <= 1 ? "ahora" : `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 48)
        return hours === 1 ? "hace 1h" : `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return days === 1 ? "ayer" : `hace ${days}d`;
}
