import type { DeltaItem } from "../types/dashboard";

type Props = {
  items: DeltaItem[];
};

function formatDelta(item: DeltaItem): string {
  if (item.delta_pct === null) {
    return "N/A";
  }
  const sign = item.delta_pct > 0 ? "+" : "";
  return `${sign}${item.delta_pct.toFixed(2)}%`;
}

export function DeltaCards({ items }: Props) {
  return (
    <section className="card-grid" aria-label="Period over period delta">
      {items.map((item) => (
        <article key={item.platform} className={`kpi-card status-${item.status}`}>
          <h3>{item.platform}</h3>
          <p>Current: ${item.current_volume_usd.toLocaleString()}</p>
          <p>Previous: ${item.previous_volume_usd.toLocaleString()}</p>
          <strong>{formatDelta(item)}</strong>
        </article>
      ))}
    </section>
  );
}
