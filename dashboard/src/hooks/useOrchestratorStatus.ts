import { useCallback, useEffect, useState } from "react";
import type { OrchestratorSnapshot } from "../../shared/types";

const STATIC = import.meta.env.VITE_STATIC_PORTFOLIO === "1";
const STATIC_POLL_MS = 5 * 60_000;

function statusUrl(): string {
  if (STATIC) return `${import.meta.env.BASE_URL}data/status.json?t=${Date.now()}`;
  return "/api/status";
}

export function useOrchestratorStatus(intervalMs: number) {
  const [data, setData] = useState<OrchestratorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(statusUrl());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as OrchestratorSnapshot;
      setData(json);
      setError(null);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const pollMs = STATIC ? STATIC_POLL_MS : intervalMs;
    const id = setInterval(fetchStatus, pollMs);
    return () => clearInterval(id);
  }, [fetchStatus, intervalMs]);

  return { data, error, loading, lastFetch, refresh: fetchStatus, isStatic: STATIC };
}
