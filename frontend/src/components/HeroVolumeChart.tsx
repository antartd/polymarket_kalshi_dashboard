import {
  Line,
  LineChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceDot,
} from "recharts";
import { I18N, type UiLang } from "../i18n";
import type { Platform, VolumePoint } from "../types/dashboard";

type Props = {
  series: VolumePoint[];
  anomalies: Array<{ date: string; platform: Platform; volume_usd: number }>;
  chartType: "line" | "bar";
  showKalshi: boolean;
  showPolymarket: boolean;
  showTotal: boolean;
  lang?: UiLang;
};

type CombinedPoint = {
  date: string;
  polymarket: number | null;
  kalshi: number | null;
};

function combineSeries(series: VolumePoint[]): CombinedPoint[] {
  const map = new Map<string, CombinedPoint>();

  for (const row of series) {
    const current =
      map.get(row.date) ??
      ({ date: row.date, polymarket: null, kalshi: null } as CombinedPoint);

    current[row.platform] = row.volume_usd;
    map.set(row.date, current);
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function HeroVolumeChart({
  series,
  anomalies,
  chartType,
  showKalshi,
  showPolymarket,
  showTotal,
  lang = "en",
}: Props) {
  const t = I18N[lang];
  const data = combineSeries(series);
  const enrichedData = data.map((item) => ({
    ...item,
    total: (item.kalshi ?? 0) + (item.polymarket ?? 0),
  }));

  return (
    <div className="chart-panel">
      <ResponsiveContainer width="100%" height={360}>
        {chartType === "line" ? (
          <LineChart data={enrichedData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="linePolymarket" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#16c79a" />
                <stop offset="100%" stopColor="#39a9ff" />
              </linearGradient>
              <linearGradient id="lineKalshi" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ff9f5a" />
                <stop offset="100%" stopColor="#ff4b86" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--grid)" />
            <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: "var(--tooltip-bg)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--text)",
                boxShadow: "0 12px 24px rgba(0,0,0,0.16)",
              }}
            />
            <Legend wrapperStyle={{ paddingTop: 6 }} />
            {showTotal && (
              <Line
                type="monotone"
                dataKey="total"
                name={t.total}
                stroke="#8B5CF6"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
            {showPolymarket && (
              <Line
                type="monotone"
                dataKey="polymarket"
                stroke="url(#linePolymarket)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
              />
            )}
            {showKalshi && (
              <Line
                type="monotone"
                dataKey="kalshi"
                stroke="url(#lineKalshi)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
              />
            )}
            {anomalies.map((point) => (
              <ReferenceDot
                key={`${point.date}-${point.platform}`}
                x={point.date}
                y={point.volume_usd}
                r={4.5}
                fill="#ff445e"
                stroke="none"
                ifOverflow="extendDomain"
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={enrichedData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }} barGap={4}>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--grid)" />
            <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: "var(--tooltip-bg)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--text)",
                boxShadow: "0 12px 24px rgba(0,0,0,0.16)",
              }}
            />
            <Legend wrapperStyle={{ paddingTop: 6 }} />
            {showKalshi && <Bar dataKey="kalshi" fill="#ff7d5c" radius={[4, 4, 0, 0]} />}
            {showPolymarket && <Bar dataKey="polymarket" fill="#2c9bff" radius={[4, 4, 0, 0]} />}
            {showTotal && <Bar dataKey="total" fill="#8B5CF6" radius={[4, 4, 0, 0]} />}
          </BarChart>
        )}
        
      </ResponsiveContainer>
    </div>
  );
}
