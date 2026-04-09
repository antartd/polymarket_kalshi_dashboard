import type {
  AnomalyResponse,
  CategoryShareResponse,
  DashboardFilters,
  DeltaResponse,
  VolumeResponse,
} from "../types/dashboard";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

function buildQuery(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  params.set("range", filters.range);
  params.set("categories", filters.categories.join(","));
  params.set("platforms", filters.platforms.join(","));
  return params.toString();
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchVolume(filters: DashboardFilters): Promise<VolumeResponse> {
  return fetchJson<VolumeResponse>(`/analytics/volume?${buildQuery(filters)}`);
}

export async function fetchDelta(filters: DashboardFilters): Promise<DeltaResponse> {
  return fetchJson<DeltaResponse>(`/analytics/delta?${buildQuery(filters)}`);
}

export async function fetchCategoryShare(filters: DashboardFilters): Promise<CategoryShareResponse> {
  return fetchJson<CategoryShareResponse>(`/analytics/category-share?${buildQuery(filters)}`);
}

export async function fetchAnomalies(filters: DashboardFilters): Promise<AnomalyResponse> {
  return fetchJson<AnomalyResponse>(`/analytics/anomalies?${buildQuery(filters)}`);
}

export function getExportCsvUrl(filters: DashboardFilters): string {
  return `${API_BASE}/analytics/export.csv?${buildQuery(filters)}`;
}
