import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectPortfolio, collectProjectById } from "./portfolio-collector.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? "3099");
const PORTFOLIO_POLL_MS = Number(process.env.PORTFOLIO_POLL_SEC ?? "60") * 1000;
const isProd = process.env.NODE_ENV === "production";
const app = express();
let latestPortfolio = collectPortfolio();
setInterval(() => {
    try {
        latestPortfolio = collectPortfolio();
    }
    catch (err) {
        console.error("[portfolio-collector]", err);
    }
}, PORTFOLIO_POLL_MS);
app.get("/api/portfolio", (_req, res) => {
    res.json(latestPortfolio);
});
app.get("/api/projects/:id", (req, res) => {
    try {
        const project = collectProjectById(req.params.id);
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
    });
});
if (isProd) {
    const dist = path.resolve(__dirname, "../../dist");
    app.use(express.static(dist, { index: false }));
    app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile("index.html", { root: dist });
    });
}
app.listen(PORT, "127.0.0.1", () => {
    console.log(`[portfolio-dashboard] http://127.0.0.1:${PORT}  portfolio=${PORTFOLIO_POLL_MS}ms`);
});
