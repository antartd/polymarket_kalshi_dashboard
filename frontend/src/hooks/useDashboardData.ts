import { useEffect, useState } from "react";
import {
  fetchAnomalies,
  fetchCategoryShare,
  fetchDelta,
  fetchLastUpdated,
  fetchVolume,
} from "../api/client";
import type {
  AnomalyResponse,
  CategoryShareResponse,
  DashboardFilters,
  DeltaResponse,
  LastUpdatedResponse,
  VolumeResponse,
} from "../types/dashboard";

type DashboardData = {
  volume: VolumeResponse | null;
  delta: DeltaResponse | null;
  categoryShare: CategoryShareResponse | null;
  anomalies: AnomalyResponse | null;
  lastUpdated: LastUpdatedResponse | null;
};

export function useDashboardData(filters: DashboardFilters, refreshSignal = 0) {
  const [data, setData] = useState<DashboardData>({
    volume: null,
    delta: null,
    categoryShare: null,
    anomalies: null,
    lastUpdated: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const hasData = data.volume !== null || data.delta !== null || data.categoryShare !== null;
      if (!hasData) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        const [volume, delta, categoryShare, anomalies, lastUpdated] = await Promise.all([
          fetchVolume(filters),
          fetchDelta(filters),
          fetchCategoryShare(filters),
          fetchAnomalies(filters),
          fetchLastUpdated(),
        ]);

        if (!cancelled) {
          setData({ volume, delta, categoryShare, anomalies, lastUpdated });
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unknown request error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [filters, refreshSignal]);

  return {
    data,
    loading,
    refreshing,
    error,
  };
}
