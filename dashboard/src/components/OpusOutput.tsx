import type { OrchestratorSnapshot } from "../../shared/types";

export function OpusOutput({
  lines,
  agent,
}: {
  lines: string[];
  agent: OrchestratorSnapshot["agent"];
}) {
  return (
    <div className="panel">
      <h2>Salida Opus</h2>
      <p className="meta">
        Inicio: {agent.lastOpusStart?.slice(11, 19) ?? "—"} · Fin:{" "}
        {agent.lastOpusDone?.slice(11, 19) ?? "—"}
      </p>
      <pre>{lines.length ? lines.join("\n") : "(sin salida reciente)"}</pre>
      <style>{`
        .meta {
          font-size: 0.72rem;
          color: var(--muted);
          margin: 0 0 0.5rem;
        }
        pre {
          background: #0a0c10;
          border-radius: 8px;
          padding: 0.65rem;
          font-size: 0.7rem;
          max-height: 280px;
          overflow: auto;
          margin: 0;
          color: #b8c0d4;
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
}
