import { I18N, type UiLang } from "../i18n";
import type { DeltaItem } from "../types/dashboard";

type Props = {
  items: DeltaItem[];
  lang?: UiLang;
};

function formatDelta(item: DeltaItem, lang: UiLang): string {
  if (item.delta_pct === null) {
    return I18N[lang].notAvailable;
  }
  const sign = item.delta_pct > 0 ? "+" : "";
  return `${sign}${item.delta_pct.toFixed(2)}%`;
}

export function DeltaCards({ items, lang = "en" }: Props) {
  const t = I18N[lang];

  return (
    <section className="card-grid" aria-label={t.periodDelta}>
      {items.map((item) => (
        <article key={item.platform} className={`kpi-card status-${item.status}`}>
          <h3>{item.platform}</h3>
          <p>{t.current}: ${item.current_volume_usd.toLocaleString()}</p>
          <p>{t.previous}: ${item.previous_volume_usd.toLocaleString()}</p>
          <strong>{formatDelta(item, lang)}</strong>
        </article>
      ))}
    </section>
  );
}
