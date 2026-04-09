import { useEffect, useState } from "react";
import {
  fetchAnomalies,
  fetchCategoryShare,
  fetchDelta,
  fetchVolume,
} from "../api/client";
import type {
  AnomalyResponse,
  CategoryShareResponse,
  DashboardFilters,
  DeltaResponse,
  VolumeResponse,
} from "../types/dashboard";

type DashboardData = {
  volume: VolumeResponse | null;
  delta: DeltaResponse | null;
  categoryShare: CategoryShareResponse | null;
  anomalies: AnomalyResponse | null;
};

export function useDashboardData(filters: DashboardFilters) {
  const [data, setData] = useState<DashboardData>({
    volume: null,
    delta: null,
    categoryShare: null,
    anomalies: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const [volume, delta, categoryShare, anomalies] = await Promise.all([
          fetchVolume(filters),
          fetchDelta(filters),
          fetchCategoryShare(filters),
          fetchAnomalies(filters),
        ]);

        if (!cancelled) {
          setData({ volume, delta, categoryShare, anomalies });
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unknown request error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [filters]);

  return {
    data,
    loading,
    error,
  };
}
