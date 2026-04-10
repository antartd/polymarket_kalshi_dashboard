import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CATEGORY_LABELS, type UiLang } from "../i18n";
import type { Category, CategoryShareResponse } from "../types/dashboard";

type Props = {
  data: CategoryShareResponse["items"];
  lang?: UiLang;
};

const COLORS = ["#1b8a5a", "#ff6f3c", "#2f4b7c", "#e99b17", "#0086a8", "#a23b72", "#6f4e7c", "#5f6b6d"];

export function CategoryShareChart({ data, lang = "en" }: Props) {
  const labels = CATEGORY_LABELS[lang];
  const labelFor = (category: string) => labels[category as Category] ?? category;

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
            innerRadius={62}
            outerRadius={112}
            paddingAngle={2}
            stroke="transparent"
            label={(entry) => `${labelFor(String(entry.category))}: ${entry.share_pct.toFixed(1)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--tooltip-bg)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              color: "var(--text)",
              boxShadow: "0 12px 24px rgba(0,0,0,0.16)",
            }}
          />
          <Legend wrapperStyle={{ paddingTop: 8 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
