import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CategoryShareResponse } from "../types/dashboard";

type Props = {
  data: CategoryShareResponse["items"];
};

const COLORS = ["#1b8a5a", "#ff6f3c", "#2f4b7c", "#e99b17", "#0086a8", "#a23b72", "#6f4e7c", "#5f6b6d"];

export function CategoryShareChart({ data }: Props) {
  return (
    <div className="chart-panel">
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            dataKey="volume_usd"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={(entry) => `${entry.category}: ${entry.share_pct}%`}
          >
            {data.map((entry, index) => (
              <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
