import { useCallback, useEffect, useState } from "react";
import type { PortfolioSnapshot } from "../shared/types";

const STATIC_PORTFOLIO = import.meta.env.VITE_STATIC_PORTFOLIO === "1";

function portfolioUrl(): string {
  if (STATIC_PORTFOLIO) {
    return `${import.meta.env.BASE_URL}data/portfolio.json`;
  }
  return "/api/portfolio";
}

export function usePortfolioStatus(intervalMs: number) {
  const [data, setData] = useState<PortfolioSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch(portfolioUrl());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PortfolioSnapshot;
      setData(json);
      setError(null);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    if (STATIC_PORTFOLIO) return;
    const id = setInterval(fetchPortfolio, intervalMs);
    return () => clearInterval(id);
  }, [fetchPortfolio, intervalMs]);

  return { data, error, loading, lastFetch, refetch: fetchPortfolio, isStatic: STATIC_PORTFOLIO };
}
