import { Link } from "react-router-dom";
import { useOrchestratorStatus } from "./hooks/useOrchestratorStatus";
import { ClaudeBuddy } from "./components/ClaudeBuddy";
import { KpiStrip } from "./components/KpiStrip";
import { ProgramChart } from "./components/ProgramChart";
import { ActiveEpicPanel } from "./components/ActiveEpicPanel";
import { PipelineFlow } from "./components/PipelineFlow";
import { ActivityFeed } from "./components/ActivityFeed";
import "./App.css";

export default function DosmentesView() {
  const { data, error, loading, lastFetch, isStatic } = useOrchestratorStatus(30_000);

  if (loading && !data) {
    return <div className="loading">Cargando orquestador…</div>;
  }

  if (error && !data) {
    return (
      <div className="loading error">
        No se pudo conectar al API.
        <br />
        <code>ssh -N -L 3099:127.0.0.1:3099 claude@tu-vps</code>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="app">
      <header className="header header-row">
        <div>
          <Link to="/" className="back-link">
            ← Portfolio
          </Link>
          <h1>DosMentes · Command Center</h1>
          <p className="subtitle">
            Orquestador · sync{" "}
            {new Date(data.generatedAt).toLocaleString("es")}
            {lastFetch && ` · fetch ${lastFetch.toLocaleTimeString("es")}`}
            {isStatic && " · snapshot VPS · publicado cada ~30 min · auto-refresh 5 min"}
          </p>
        </div>
      </header>

      <KpiStrip data={data} />

      <section className="main-grid">
        <ClaudeBuddy buddy={data.buddy} />
        <div className="charts-col">
          <ProgramChart
            epics={data.program.epics}
            percent={data.program.percent}
          />
          <ActiveEpicPanel epic={data.program.activeEpic} />
        </div>
      </section>

      <section className="bottom-row">
        <PipelineFlow state={data.agent.state} />
        <ActivityFeed entries={data.timeline} />
      </section>
    </div>
  );
}
