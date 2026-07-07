function clamp(n) {
    return Math.max(8, Math.min(98, Math.round(n)));
}
function shortUc(uc) {
    return uc?.replace("UC-DM-", "") ?? "";
}
function buildStatusBadge(state, ctx) {
    const uc = shortUc(ctx.currentUc);
    switch (state) {
        case "running":
            return {
                label: uc ? `Implementando ${uc}` : "Opus en desarrollo",
                variant: "active",
            };
        case "waiting":
            return {
                label: ctx.nextUc
                    ? `En cola · ${shortUc(ctx.nextUc)}`
                    : "Esperando próximo ciclo",
                variant: "warning",
            };
        case "git_busy":
            return { label: "Supervisor · flujo Git", variant: "info" };
        case "done_pending":
            return {
                label: uc ? `${uc} lista para merge` : "UC lista",
                variant: "success",
            };
        case "error": {
            const block = ctx.bloqueos.replace(/^ninguno\.?/i, "").trim();
            return {
                label: block
                    ? block.slice(0, 48) + (block.length > 48 ? "…" : "")
                    : "Bloqueo detectado",
                variant: "error",
            };
        }
        default:
            if (/^procesado$/i.test(ctx.estado)) {
                return { label: "Pipeline al día", variant: "success" };
            }
            if (uc) {
                return { label: `Última UC · ${uc}`, variant: "info" };
            }
            return { label: "En espera", variant: "info" };
    }
}
function moodFromState(state, badge) {
    switch (state) {
        case "running":
            return { mood: "working", label: badge.label };
        case "waiting":
            return { mood: "waiting", label: badge.label };
        case "git_busy":
            return { mood: "git", label: badge.label };
        case "done_pending":
            return { mood: "celebrating", label: badge.label };
        case "error":
            return { mood: "error", label: badge.label };
        default:
            return { mood: "idle", label: badge.label };
    }
}
export function buildBuddy(agentState, programPercent, lockAgeMin, ctx) {
    const statusBadge = buildStatusBadge(agentState, ctx);
    const { mood, label } = moodFromState(agentState, statusBadge);
    const stats = [
        {
            key: "DEBUGGING",
            value: clamp(agentState === "running"
                ? 92
                : agentState === "error"
                    ? 75
                    : 55 + programPercent * 0.3),
        },
        {
            key: "PATIENCE",
            value: clamp(agentState === "waiting" ? 88 : lockAgeMin && lockAgeMin > 30 ? 40 : 70),
        },
        {
            key: "CHAOS",
            value: clamp(agentState === "git_busy"
                ? 65
                : agentState === "error"
                    ? 80
                    : 25 + programPercent * 0.2),
        },
        {
            key: "WISDOM",
            value: clamp(50 + programPercent * 0.45),
        },
        {
            key: "SNARK",
            value: clamp(agentState === "error" ? 70 : agentState === "idle" ? 45 : 30),
        },
    ];
    return {
        name: "Capito",
        species: "Claude Code Bot",
        rarity: "Epic",
        mood,
        moodLabel: label,
        statusBadge,
        stats,
    };
}
