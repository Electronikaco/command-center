import { useCallback, useEffect, useState } from "react";
import type { OrchestratorSnapshot } from "../../shared/types";

export function useOrchestratorStatus(intervalMs: number) {
  const [data, setData] = useState<OrchestratorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
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
    const id = setInterval(fetchStatus, intervalMs);
    return () => clearInterval(id);
  }, [fetchStatus, intervalMs]);

  return { data, error, loading, lastFetch, refresh: fetchStatus };
}
