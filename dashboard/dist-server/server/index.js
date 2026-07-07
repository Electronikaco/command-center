import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collect } from "./collector.js";
import { collectPortfolio, collectProjectById } from "./portfolio-collector.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? "3099");
const STATUS_POLL_MS = Number(process.env.POLL_SEC ?? "30") * 1000;
const PORTFOLIO_POLL_MS = Number(process.env.PORTFOLIO_POLL_SEC ?? "60") * 1000;
const isProd = process.env.NODE_ENV === "production";
const app = express();
let latestStatus = collect();
let latestPortfolio = collectPortfolio(undefined, latestStatus);
setInterval(() => {
    try {
        latestStatus = collect();
    }
    catch (err) {
        console.error("[collector]", err);
    }
}, STATUS_POLL_MS);
setInterval(() => {
    try {
        latestPortfolio = collectPortfolio(undefined, latestStatus);
    }
    catch (err) {
        console.error("[portfolio-collector]", err);
    }
}, PORTFOLIO_POLL_MS);
app.get("/api/status", (_req, res) => {
    res.json(latestStatus);
});
app.get("/api/portfolio", (_req, res) => {
    res.json(latestPortfolio);
});
app.get("/api/projects/:id", (req, res) => {
    try {
        const project = collectProjectById(req.params.id, latestStatus);
        if (!project) {
            res.status(404).json({ error: "Proyecto no encontrado" });
            return;
        }
        res.json(project);
    }
    catch (err) {
        res.status(500).json({
            error: err instanceof Error ? err.message : "Error al recolectar proyecto",
        });
    }
});
app.get("/api/health", (_req, res) => {
    res.json({
        ok: true,
        generatedAt: latestPortfolio.generatedAt,
        statusAt: latestStatus.generatedAt,
    });
});
if (isProd) {
    const dist = path.join(__dirname, "../../dist");
    app.use(express.static(dist));
    app.use((_req, res) => {
        res.sendFile(path.join(dist, "index.html"));
    });
}
app.listen(PORT, "127.0.0.1", () => {
    console.log(`[orchestrator-dashboard] http://127.0.0.1:${PORT}  status=${STATUS_POLL_MS}ms portfolio=${PORTFOLIO_POLL_MS}ms`);
});
