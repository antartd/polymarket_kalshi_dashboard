import { useMemo, useState } from "react";
import { getExportCsvUrl } from "./api/client";
import { CategoryFilterGroup } from "./components/CategoryFilterGroup";
import { CategoryShareChart } from "./components/CategoryShareChart";
import { DeltaCards } from "./components/DeltaCards";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { ExportCsvButton } from "./components/ExportCsvButton";
import { HeroVolumeChart } from "./components/HeroVolumeChart";
import { LoadingState } from "./components/LoadingState";
import { RangeSelector } from "./components/RangeSelector";
import { ThemeToggle } from "./components/ThemeToggle";
import { useDashboardData } from "./hooks/useDashboardData";
import { CATEGORIES, type DashboardFilters, type Platform, type RangePreset } from "./types/dashboard";

const THEME_KEY = "pm-kalshi-theme";

function getInitialDarkMode(): boolean {
  return localStorage.getItem(THEME_KEY) === "dark";
}

export function App() {
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [filters, setFilters] = useState<DashboardFilters>({
    range: "30d",
    categories: [...CATEGORIES],
    platforms: ["polymarket", "kalshi"],
  });

  const { data, loading, error } = useDashboardData(filters);

  const exportUrl = useMemo(() => getExportCsvUrl(filters), [filters]);

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  }

  function updateRange(range: RangePreset) {
    setFilters((prev) => ({ ...prev, range }));
  }

  function updateCategories(categories: DashboardFilters["categories"]) {
    setFilters((prev) => ({ ...prev, categories }));
  }

  function togglePlatform(platform: Platform) {
    setFilters((prev) => {
      const exists = prev.platforms.includes(platform);
      return {
        ...prev,
        platforms: exists
          ? prev.platforms.filter((item) => item !== platform)
          : [...prev.platforms, platform],
      };
    });
  }

  const allCategoriesDisabled = filters.categories.length === 0;

  return (
    <main className={`app ${darkMode ? "dark" : "light"}`}>
      <header className="header">
        <h1>Polymarket vs Kalshi Volume Dashboard</h1>
        <div className="header-actions">
          <ExportCsvButton url={exportUrl} />
          <ThemeToggle dark={darkMode} onToggle={toggleTheme} />
        </div>
      </header>

      <section className="panel controls">
        <RangeSelector value={filters.range} onChange={updateRange} />

        <div className="platform-group" role="group" aria-label="Platform filters">
          {(["polymarket", "kalshi"] as Platform[]).map((platform) => {
            const checked = filters.platforms.includes(platform);
            return (
              <label key={platform} className={`chip ${checked ? "chip-on" : "chip-off"}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => togglePlatform(platform)}
                  aria-label={platform}
                />
                <span>{platform}</span>
              </label>
            );
          })}
        </div>

        <CategoryFilterGroup value={filters.categories} onChange={updateCategories} />
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}

      {!loading && !error && allCategoriesDisabled && (
        <EmptyState message="Select at least one category to display volume data." />
      )}

      {!loading && !error && !allCategoriesDisabled && (
        <>
          <section className="panel">
            {data.volume?.empty ? (
              <EmptyState message={data.volume.message ?? "No volume data."} />
            ) : (
              <HeroVolumeChart series={data.volume?.series ?? []} anomalies={data.anomalies?.items ?? []} />
            )}
          </section>

          <section className="panel">
            {data.delta?.empty ? (
              <EmptyState message={data.delta.message ?? "No delta data."} />
            ) : (
              <DeltaCards items={data.delta?.items ?? []} />
            )}
          </section>

          <section className="panel">
            {data.categoryShare?.empty ? (
              <EmptyState message={data.categoryShare.message ?? "No category share data."} />
            ) : (
              <CategoryShareChart data={data.categoryShare?.items ?? []} />
            )}
          </section>
        </>
      )}
    </main>
  );
}
