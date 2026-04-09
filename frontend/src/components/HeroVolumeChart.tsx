import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceDot,
} from "recharts";
import type { Platform, VolumePoint } from "../types/dashboard";

type Props = {
  series: VolumePoint[];
  anomalies: Array<{ date: string; platform: Platform; volume_usd: number }>;
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

export function HeroVolumeChart({ series, anomalies }: Props) {
  const data = combineSeries(series);

  return (
    <div className="chart-panel">
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="polymarket" stroke="#1b8a5a" strokeWidth={2.5} />
          <Line type="monotone" dataKey="kalshi" stroke="#ff6f3c" strokeWidth={2.5} />
          {anomalies.map((point) => (
            <ReferenceDot
              key={`${point.date}-${point.platform}`}
              x={point.date}
              y={point.volume_usd}
              r={4}
              fill="#d7191c"
              stroke="none"
              ifOverflow="extendDomain"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
