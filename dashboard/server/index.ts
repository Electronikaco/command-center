import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collect } from "./collector.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? "3099");
const POLL_MS = Number(process.env.POLL_SEC ?? "30") * 1000;
const isProd = process.env.NODE_ENV === "production";

const app = express();

let latest = collect();

setInterval(() => {
  try {
    latest = collect();
  } catch (err) {
    console.error("[collector]", err);
  }
}, POLL_MS);

app.get("/api/status", (_req, res) => {
  res.json(latest);
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, generatedAt: latest.generatedAt });
});

if (isProd) {
  const dist = path.join(__dirname, "../../dist");
  app.use(express.static(dist));
  app.use((_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[orchestrator-dashboard] http://127.0.0.1:${PORT}  poll=${POLL_MS}ms`,
  );
});
