import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getExportCsvUrl } from "./api/client";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { useDashboardData } from "./hooks/useDashboardData";
import { useLiveUpdates } from "./hooks/useLiveUpdates";
import { CATEGORY_LABELS, formatDateTime, getInitialLang, I18N, LANG_KEY, PERIOD_LABELS, type UiLang } from "./i18n";
import { CATEGORIES, type Category, type DashboardFilters, type DataSource, type RangePreset } from "./types/dashboard";

const K_COLOR = "#10B981";
const P_COLOR = "#3B82F6";
const C_COLOR = "#8B5CF6";
const THEME_KEY = "pm-kalshi-theme";
const TOTAL_KEY = "total";

const CATEGORY_COLORS: Record<Category, string> = {
  politics: "#F97316",
  sports: "#06B6D4",
  geopolitics: "#EF4444",
  culture: "#EC4899",
  crypto: "#F59E0B",
  finance: "#34D399",
  tech_science: "#A78BFA",
  other: "#94A3B8",
};

const PERIODS: RangePreset[] = ["7d", "30d", "90d", "all"];

const DARK = {
  bg: "#070C18",
  surface: "#0C1526",
  surfaceAlt: "#0A1220",
  border: "#243247",
  borderSub: "#1B2A3F",
  text: "#F1F5FB",
  textMuted: "#A7B7CC",
  textFaint: "#8EA2BE",
  grid: "#1C2A3D",
  axisTick: "#C3D2E4",
  headerBg: "rgba(7,12,24,0.88)",
  pillOff: "#2A3B54",
  pillOffText: "#B5C4D8",
  metricSub: "#A3B4CA",
  rowHover: "#122139",
  totalRow: "#0A1220",
  tooltipBg: "#0C1831",
  tooltipBorder: "#324765",
  kText: "#6EE7B7",
  pText: "#9BCDFE",
  cText: "#D0C2FF",
};

const LIGHT = {
  bg: "#F1F5F9",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  border: "#E2E8F0",
  borderSub: "#EDF2F7",
  text: "#0F172A",
  textMuted: "#64748B",
  textFaint: "#CBD5E1",
  grid: "#EDF2F7",
  axisTick: "#94A3B8",
  headerBg: "rgba(241,245,249,0.92)",
  pillOff: "#E2E8F0",
  pillOffText: "#94A3B8",
  metricSub: "#94A3B8",
  rowHover: "#F8FAFC",
  totalRow: "#F1F5F9",
  tooltipBg: "#FFFFFF",
  tooltipBorder: "#E2E8F0",
  kText: "#059669",
  pText: "#2563EB",
  cText: "#7C3AED",
};


function getInitialDarkMode(): boolean {
  return localStorage.getItem(THEME_KEY) === "dark";
}

function fmt(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function makeTooltip(th: typeof DARK | typeof LIGHT, lang: UiLang) {
  const t = I18N[lang];
  return function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number }>; label?: string }) {
    if (!active || !payload?.length) return null;

    const k = payload.find((p) => p.dataKey === "Kalshi")?.value ?? 0;
    const p = payload.find((p) => p.dataKey === "Polymarket")?.value ?? 0;
    const total = payload.find((p) => p.dataKey === TOTAL_KEY)?.value ?? (k + p);

    const kPct = total > 0 ? (k / total) * 100 : 0;
    const pPct = total > 0 ? (p / total) * 100 : 0;
    const diff = k - p;
    const diffAbs = Math.abs(diff);
    const diffPct = total > 0 ? (diffAbs / total) * 100 : 0;
    const diffLeader = diff > 0 ? "Kalshi" : diff < 0 ? "Polymarket" : t.parity;
    const diffColor = diff > 0 ? th.kText : diff < 0 ? th.pText : th.textMuted;

    return (
      <div
        style={{
          background: th.tooltipBg,
          border: `1px solid ${th.tooltipBorder}`,
          borderRadius: 10,
          padding: "12px 16px",
          minWidth: 210,
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontSize: 11, color: th.textMuted, marginBottom: 10, letterSpacing: "0.04em" }}>{label}</div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: K_COLOR }} />
            <span style={{ fontSize: 12, color: th.textMuted }}>Kalshi</span>
          </div>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: th.kText, fontVariantNumeric: "tabular-nums" }}>{fmt(k)}</span>
            <span style={{ fontSize: 10, color: th.textMuted, marginLeft: 5 }}>{kPct.toFixed(1)}%</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: P_COLOR }} />
            <span style={{ fontSize: 12, color: th.textMuted }}>Polymarket</span>
          </div>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: th.pText, fontVariantNumeric: "tabular-nums" }}>{fmt(p)}</span>
            <span style={{ fontSize: 10, color: th.textMuted, marginLeft: 5 }}>{pPct.toFixed(1)}%</span>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${th.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: th.textMuted }}>{t.total}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: th.cText, fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</span>
        </div>

        <div style={{ borderTop: `1px solid ${th.border}`, marginTop: 8, paddingTop: 8 }}>
          <div style={{ fontSize: 12, color: th.textMuted, marginBottom: 4 }}>{t.edge}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: diffColor, fontWeight: 700 }}>{t.edgeDirection}: {diffLeader}</span>
            <span style={{ fontSize: 12, color: diffColor, fontWeight: 700 }}>
              {diffAbs > 0 ? `${fmt(diffAbs)} · ${diffPct.toFixed(1)}%` : "0"}
            </span>
          </div>
        </div>
      </div>
    );
  };
}

export function App() {
  const [dark, setDark] = useState(getInitialDarkMode);
  const [lang, setLang] = useState<UiLang>(getInitialLang);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(max-width: 900px)").matches;
  });
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const [showK, setShowK] = useState(true);
  const [showP, setShowP] = useState(true);
  const [showC, setShowC] = useState(true);
  const [cats, setCats] = useState<Set<Category>>(new Set(CATEGORIES));

  const [filters, setFilters] = useState<DashboardFilters>({
    range: "30d",
    source: "dune",
    categories: [...CATEGORIES],
    platforms: ["polymarket", "kalshi"],
  });

  const th = dark ? DARK : LIGHT;
  const t = I18N[lang];
  const categoryLabels = CATEGORY_LABELS[lang];
  const isLiveMode = filters.source === "live";

  const { refreshTick, streamConnected } = useLiveUpdates(isLiveMode);
  const { data, loading, refreshing, error } = useDashboardData(filters, isLiveMode ? refreshTick : 0);

  const exportUrl = useMemo(() => getExportCsvUrl(filters), [filters]);
  const allCategoriesDisabled = filters.categories.length === 0;

  const chartData = useMemo(() => {
    const byDate = new Map<string, { label: string; Kalshi: number; Polymarket: number; total: number }>();
    for (const row of data.volume?.series ?? []) {
      const item = byDate.get(row.date) ?? { label: row.date, Kalshi: 0, Polymarket: 0, total: 0 };
      if (row.platform === "kalshi") item.Kalshi += row.volume_usd;
      if (row.platform === "polymarket") item.Polymarket += row.volume_usd;
      item.total = item.Kalshi + item.Polymarket;
      byDate.set(row.date, item);
    }
    return [...byDate.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [data.volume]);

  const totals = useMemo(
    () =>
      chartData.reduce(
        (acc, row) => ({
          k: acc.k + row.Kalshi,
          p: acc.p + row.Polymarket,
          c: acc.c + row.total,
        }),
        { k: 0, p: 0, c: 0 },
      ),
    [chartData],
  );

  const catStats = useMemo(() => {
    const items = data.categoryShare?.items ?? [];
    return items
      .filter((row) => cats.has(row.category))
      .map((row) => ({
        id: row.category,
        label: categoryLabels[row.category],
        color: CATEGORY_COLORS[row.category],
        total: row.volume_usd,
        share: row.share_pct,
        kalshiVolume: row.kalshi_volume_usd,
        polymarketVolume: row.polymarket_volume_usd,
        kalshiShareInCategory: row.kalshi_share_in_category_pct,
        polymarketShareInCategory: row.polymarket_share_in_category_pct,
        kalshiShareOfTotal: row.kalshi_share_of_total_pct,
        polymarketShareOfTotal: row.polymarket_share_of_total_pct,
      }))
      .sort((a, b) => b.total - a.total);
  }, [data.categoryShare, cats, categoryLabels]);

  const CustomTooltip = useMemo(() => makeTooltip(th, lang), [th, lang]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 900px)");
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const segBtn = (active: boolean) => ({
    padding: "5px 13px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    border: `1px solid ${active ? P_COLOR : th.border}`,
    background: active ? (dark ? `${P_COLOR}20` : "#EFF6FF") : "transparent",
    color: active ? (dark ? "#93C5FD" : "#2563EB") : th.textMuted,
    transition: "all 0.15s",
  });

  const togBtn = (active: boolean, color: string) => ({
    padding: "5px 13px",
    borderRadius: 20,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    border: `1px solid ${active ? `${color}70` : th.border}`,
    background: active ? `${color}${dark ? "18" : "12"}` : "transparent",
    color: active ? color : th.textMuted,
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s",
  });

  const toggleCategory = (category: Category) => {
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      setFilters((old) => ({ ...old, categories: [...next] }));
      return next;
    });
  };

  const updateRange = (range: RangePreset) => {
    setFilters((prev) => ({ ...prev, range }));
  };

  const updateSource = (source: DataSource) => {
    setFilters((prev) => ({ ...prev, source }));
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  };
  const toggleLang = () => {
    const next: UiLang = lang === "ru" ? "en" : "ru";
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
  };

  return (
    <div style={{ background: th.bg, minHeight: "100vh", color: th.text, fontFamily: "system-ui, -apple-system, sans-serif", transition: "background 0.2s" }}>
      <header
        style={{
          padding: isMobile ? "10px 12px" : "12px 32px",
          borderBottom: `1px solid ${th.borderSub}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: isMobile ? "wrap" : "nowrap",
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: th.headerBg,
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke={C_COLOR} strokeWidth="1.5" />
            <polyline points="3,13 7,8 11,11 17,4" stroke={C_COLOR} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: isMobile ? 12 : 13, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>PREDICTION MARKETS</span>
          <span style={{ fontSize: 10, color: K_COLOR, border: `1px solid ${K_COLOR}40`, borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" }}>ANALYTICS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: isMobile ? 0 : "auto", width: isMobile ? "100%" : "auto", justifyContent: isMobile ? "space-between" : "flex-end" }}>
          <a
            href={exportUrl}
            download
            style={{
              fontSize: 13,
              color: th.textMuted,
              textDecoration: "none",
              padding: isMobile ? "10px 14px" : "10px 16px",
              minHeight: 42,
              border: `1px solid ${th.border}`,
              borderRadius: 10,
              background: th.surface,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flex: isMobile ? 1 : undefined,
            }}
          >
            {t.exportCsv}
          </a>
          <button
            onClick={toggleLang}
            style={{
              marginLeft: 4,
              minWidth: isMobile ? 54 : 60,
              height: 44,
              borderRadius: 12,
              cursor: "pointer",
              border: `1px solid ${th.border}`,
              background: th.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: isMobile ? 13 : 14,
              color: th.text,
              fontWeight: 700,
              letterSpacing: "0.04em",
              transition: "all 0.15s",
            }}
            aria-label={lang === "ru" ? t.toggleToEnglish : t.toggleToRussian}
            title={lang === "ru" ? t.toggleToEnglish : t.toggleToRussian}
          >
            {lang.toUpperCase()}
          </button>
          <button
            onClick={toggleTheme}
            style={{
              marginLeft: 4,
              width: isMobile ? 42 : 44,
              height: 44,
              borderRadius: 12,
              cursor: "pointer",
              border: `1px solid ${th.border}`,
              background: th.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              color: th.textMuted,
              transition: "all 0.15s",
            }}
            aria-label={dark ? t.switchToLight : t.switchToDark}
            title={dark ? t.switchToLight : t.switchToDark}
          >
            {dark ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <div style={{ padding: isMobile ? "16px 10px 40px" : "28px 18px 64px", width: "100%", margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: th.textMuted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>{t.volumesTitle}</div>
          <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.08, color: th.text, margin: 0 }}>
            <span style={{ color: K_COLOR }}>Kalshi</span>
            <span style={{ color: th.textFaint, fontWeight: 300, padding: "0 8px" }}>vs</span>
            <span style={{ color: P_COLOR }}>Polymarket</span>
          </h1>
          <div style={{ marginTop: 8, fontSize: isMobile ? 11 : 12, color: th.textMuted, lineHeight: 1.45 }}>
            {filters.source === "dune"
              ? `${t.sourceDune} · ${t.lastSnapshot}: ${formatDateTime(data.volume?.snapshot?.generated_at, lang)} · ${t.nextRefresh}: ${formatDateTime(data.volume?.snapshot?.next_refresh_at, lang)} (${t.hourly})`
              : `${t.sourceLive} · Stream: ${streamConnected ? t.streamConnected : t.streamReconnecting} · ${t.lastUpdate}: ${formatDateTime(data.lastUpdated?.latest_updated_at, lang)}`}
            {refreshing ? ` · ${t.updating}` : ""}
          </div>
        </div>

        {loading && <LoadingState message={t.loading} />}
        {error && <ErrorState message={error} prefix={t.errorPrefix} />}

        {!loading && !error && allCategoriesDisabled && (
          <EmptyState message={t.pickCategory} />
        )}

        {!loading && !error && !allCategoriesDisabled && (
          <>
            <div
              style={{
                background: th.surface,
                border: `1px solid ${th.border}`,
                borderRadius: 16,
                padding: isMobile ? "14px 12px 14px" : "20px 24px 24px",
                marginBottom: 20,
                boxShadow: dark ? "0 4px 40px rgba(0,0,0,0.35)" : "0 2px 24px rgba(0,0,0,0.07)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 3, background: th.surfaceAlt, borderRadius: 8, padding: 3, border: `1px solid ${th.border}`, width: isMobile ? "100%" : "auto" }}>
                  {[{ id: "dune", label: t.sourceSnapshot }, { id: "live", label: t.sourceLiveApi }].map((s) => (
                    <button key={s.id} onClick={() => updateSource(s.id as DataSource)} style={{ ...segBtn(filters.source === s.id), flex: isMobile ? 1 : undefined }}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 3, background: th.surfaceAlt, borderRadius: 8, padding: 3, border: `1px solid ${th.border}`, width: isMobile ? "100%" : "auto" }}>
                  {PERIODS.map((p) => (
                    <button key={p} onClick={() => updateRange(p)} style={{ ...segBtn(filters.range === p), flex: isMobile ? 1 : undefined }}>
                      {PERIOD_LABELS[lang][p]}
                    </button>
                  ))}
                </div>
                {!isMobile && <div style={{ width: 1, height: 22, background: th.border }} />}
                <div style={{ display: "flex", gap: 3, background: th.surfaceAlt, borderRadius: 8, padding: 3, border: `1px solid ${th.border}`, width: isMobile ? "100%" : "auto" }}>
                  {[{ id: "area", label: t.lineChart }, { id: "bar", label: t.barChart }].map((chart) => (
                    <button key={chart.id} onClick={() => setChartType(chart.id as "area" | "bar")} style={{ ...segBtn(chartType === chart.id), flex: isMobile ? 1 : undefined }}>
                      {chart.label}
                    </button>
                  ))}
                </div>
                <div style={{ flex: 1, display: isMobile ? "none" : "block" }} />
                <button onClick={() => setShowK((v) => !v)} style={togBtn(showK, K_COLOR)}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: showK ? K_COLOR : th.textFaint }} />Kalshi
                </button>
                <button onClick={() => setShowP((v) => !v)} style={togBtn(showP, P_COLOR)}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: showP ? P_COLOR : th.textFaint }} />Polymarket
                </button>
                <button onClick={() => setShowC((v) => !v)} style={togBtn(showC, C_COLOR)}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: showC ? C_COLOR : th.textFaint }} />{t.total}
                </button>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${th.borderSub}` }}>
                <span style={{ fontSize: 10, color: th.textMuted, alignSelf: "center", marginRight: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.filter}:</span>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleCategory(c)}
                    style={{
                      padding: "3px 11px",
                      borderRadius: 20,
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 500,
                      transition: "all 0.15s",
                      border: `1px solid ${cats.has(c) ? `${CATEGORY_COLORS[c]}60` : th.pillOff}`,
                      background: cats.has(c) ? `${CATEGORY_COLORS[c]}${dark ? "18" : "12"}` : "transparent",
                      color: cats.has(c) ? CATEGORY_COLORS[c] : th.pillOffText,
                    }}
                  >
                    {categoryLabels[c]}
                  </button>
                ))}
              </div>

              <div style={{ height: isMobile ? 280 : 380 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "area" ? (
                    <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="gK" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={K_COLOR} stopOpacity={dark ? 0.22 : 0.14} />
                          <stop offset="100%" stopColor={K_COLOR} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={P_COLOR} stopOpacity={dark ? 0.22 : 0.14} />
                          <stop offset="100%" stopColor={P_COLOR} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C_COLOR} stopOpacity={dark ? 0.16 : 0.09} />
                          <stop offset="100%" stopColor={C_COLOR} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 5" stroke={th.grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: th.axisTick, fontSize: isMobile ? 9 : 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tickFormatter={fmt} tick={{ fill: th.axisTick, fontSize: isMobile ? 9 : 10 }} tickLine={false} axisLine={false} width={isMobile ? 48 : 60} />
                      <Tooltip content={<CustomTooltip />} />
                      {showC && <Area type="monotone" dataKey={TOTAL_KEY} name={t.total} stroke={C_COLOR} strokeWidth={1.5} strokeDasharray="5 3" fill="url(#gC)" dot={false} activeDot={{ r: 4, fill: C_COLOR }} />}
                      {showK && <Area type="monotone" dataKey="Kalshi" name="Kalshi" stroke={K_COLOR} strokeWidth={2.5} fill="url(#gK)" dot={false} activeDot={{ r: 5, fill: K_COLOR }} />}
                      {showP && <Area type="monotone" dataKey="Polymarket" name="Polymarket" stroke={P_COLOR} strokeWidth={2.5} fill="url(#gP)" dot={false} activeDot={{ r: 5, fill: P_COLOR }} />}
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 4 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="2 5" stroke={th.grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: th.axisTick, fontSize: isMobile ? 9 : 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tickFormatter={fmt} tick={{ fill: th.axisTick, fontSize: isMobile ? 9 : 10 }} tickLine={false} axisLine={false} width={isMobile ? 48 : 60} />
                      <Tooltip content={<CustomTooltip />} />
                      {showK && <Bar dataKey="Kalshi" name="Kalshi" fill={K_COLOR} fillOpacity={0.85} radius={[3, 3, 0, 0]} />}
                      {showP && <Bar dataKey="Polymarket" name="Polymarket" fill={P_COLOR} fillOpacity={0.85} radius={[3, 3, 0, 0]} />}
                      {showC && <Bar dataKey={TOTAL_KEY} name={t.total} fill={C_COLOR} fillOpacity={0.65} radius={[3, 3, 0, 0]} />}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
              {[
                { label: "Kalshi", val: totals.k, color: K_COLOR, color2: th.kText, pct: totals.c > 0 ? (totals.k / totals.c) * 100 : null },
                { label: "Polymarket", val: totals.p, color: P_COLOR, color2: th.pText, pct: totals.c > 0 ? (totals.p / totals.c) * 100 : null },
                { label: t.summary, val: totals.c, color: C_COLOR, color2: th.cText, pct: null },
              ].map((m) => (
                <div key={m.label} style={{ background: th.surface, border: `1px solid ${th.border}`, borderRadius: 10, padding: "14px 18px", borderTop: `3px solid ${m.color}` }}>
                  <div style={{ fontSize: 10, color: th.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: m.color2, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{fmt(m.val)}</div>
                  {m.pct !== null && (
                    <div style={{ fontSize: 11, color: th.metricSub, marginTop: 4 }}>
                      <span style={{ color: m.color, fontWeight: 600 }}>{m.pct.toFixed(1)}%</span> {t.ofTotalVolume}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <h2 style={{ fontSize: 11, fontWeight: 600, color: th.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>{t.categoryComparison}</h2>
                <span style={{ fontSize: 11, color: th.textFaint }}>{filters.range.toUpperCase()}</span>
              </div>

              {isMobile ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {catStats.map((c) => (
                    <div key={c.id} style={{ background: th.surface, border: `1px solid ${th.border}`, borderRadius: 12, padding: "12px 12px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, color: th.text, fontWeight: 700 }}>{c.label}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, color: th.textMuted, marginBottom: 4 }}>Kalshi</div>
                          <div style={{ fontSize: 14, color: th.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(c.kalshiVolume)}</div>
                          <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: th.border, overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(0, Math.min(100, c.kalshiShareInCategory))}%`, height: "100%", background: K_COLOR, opacity: 0.9 }} />
                          </div>
                          <div style={{ marginTop: 5, fontSize: 11, color: th.textMuted }}>
                            {t.inCategory}: <span style={{ color: K_COLOR, fontWeight: 700 }}>{c.kalshiShareInCategory.toFixed(1)}%</span>
                          </div>
                          <div style={{ marginTop: 2, fontSize: 11, color: th.textMuted }}>
                            {t.ofOverall}: <span style={{ color: K_COLOR, fontWeight: 700 }}>{c.kalshiShareOfTotal.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: th.textMuted, marginBottom: 4 }}>Polymarket</div>
                          <div style={{ fontSize: 14, color: th.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(c.polymarketVolume)}</div>
                          <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: th.border, overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(0, Math.min(100, c.polymarketShareInCategory))}%`, height: "100%", background: P_COLOR, opacity: 0.9 }} />
                          </div>
                          <div style={{ marginTop: 5, fontSize: 11, color: th.textMuted }}>
                            {t.inCategory}: <span style={{ color: P_COLOR, fontWeight: 700 }}>{c.polymarketShareInCategory.toFixed(1)}%</span>
                          </div>
                          <div style={{ marginTop: 2, fontSize: 11, color: th.textMuted }}>
                            {t.ofOverall}: <span style={{ color: P_COLOR, fontWeight: 700 }}>{c.polymarketShareOfTotal.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ borderTop: `1px solid ${th.borderSub}`, marginTop: 10, paddingTop: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: th.textMuted }}>{t.grandTotal}</span>
                          <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", color: th.text, fontWeight: 700 }}>{fmt(c.total)}</span>
                        </div>
                        <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: th.border, overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(0, Math.min(100, c.share))}%`, height: "100%", background: c.color, opacity: 0.9 }} />
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11, color: c.color, fontWeight: 700 }}>{c.share.toFixed(1)}% {t.ofOverall}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: th.surface, border: `1px solid ${th.border}`, borderRadius: 14, overflowX: "auto" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "240px 1fr 1fr 180px",
                      padding: "14px 20px",
                      borderBottom: `1px solid ${th.borderSub}`,
                      fontSize: 12,
                      letterSpacing: "0.08em",
                      color: th.textMuted,
                      textTransform: "uppercase",
                      minWidth: 900,
                    }}
                  >
                    <div>{t.category}</div>
                    <div>Kalshi</div>
                    <div>Polymarket</div>
                    <div style={{ textAlign: "right" }}>{t.grandTotal}</div>
                  </div>

                  {catStats.map((c, i) => (
                    <div
                      key={c.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "240px 1fr 1fr 180px",
                        padding: "16px 20px",
                        borderBottom: i < catStats.length - 1 ? `1px solid ${th.borderSub}` : "none",
                        alignItems: "center",
                        minWidth: 900,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 15, color: th.text, fontWeight: 600 }}>{c.label}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 15, color: th.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(c.kalshiVolume)}</div>
                        <div style={{ marginTop: 8, height: 9, borderRadius: 999, background: th.border, overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(0, Math.min(100, c.kalshiShareInCategory))}%`, height: "100%", background: K_COLOR, opacity: 0.9 }} />
                        </div>
                        <div style={{ marginTop: 5, fontSize: 12, color: th.textMuted }}>
                          {t.inCategory}: <span style={{ color: K_COLOR, fontWeight: 700 }}>{c.kalshiShareInCategory.toFixed(1)}%</span>
                        </div>
                        <div style={{ marginTop: 3, fontSize: 12, color: th.textMuted }}>
                          {t.ofOverall}: <span style={{ color: K_COLOR, fontWeight: 700 }}>{c.kalshiShareOfTotal.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 15, color: th.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(c.polymarketVolume)}</div>
                        <div style={{ marginTop: 8, height: 9, borderRadius: 999, background: th.border, overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(0, Math.min(100, c.polymarketShareInCategory))}%`, height: "100%", background: P_COLOR, opacity: 0.9 }} />
                        </div>
                        <div style={{ marginTop: 5, fontSize: 12, color: th.textMuted }}>
                          {t.inCategory}: <span style={{ color: P_COLOR, fontWeight: 700 }}>{c.polymarketShareInCategory.toFixed(1)}%</span>
                        </div>
                        <div style={{ marginTop: 3, fontSize: 12, color: th.textMuted }}>
                          {t.ofOverall}: <span style={{ color: P_COLOR, fontWeight: 700 }}>{c.polymarketShareOfTotal.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 15, fontVariantNumeric: "tabular-nums", color: th.text, fontWeight: 700 }}>{fmt(c.total)}</div>
                        <div style={{ marginTop: 8, marginLeft: "auto", width: 120, height: 9, borderRadius: 999, background: th.border, overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(0, Math.min(100, c.share))}%`, height: "100%", background: c.color, opacity: 0.9 }} />
                        </div>
                        <div style={{ marginTop: 5, fontSize: 12, color: c.color, fontWeight: 700 }}>{c.share.toFixed(1)}% {t.ofOverall}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
