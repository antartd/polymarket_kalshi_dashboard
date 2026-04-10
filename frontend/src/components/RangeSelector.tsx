import { I18N, PERIOD_LABELS, type UiLang } from "../i18n";
import type { RangePreset } from "../types/dashboard";

const RANGES: RangePreset[] = ["7d", "30d", "90d", "all"];

type Props = {
  value: RangePreset;
  onChange: (range: RangePreset) => void;
  lang?: UiLang;
};

export function RangeSelector({ value, onChange, lang = "en" }: Props) {
  const t = I18N[lang];

  return (
    <div className="control-group" role="group" aria-label={t.rangeControl}>
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          className={`button ${value === range ? "active" : "ghost"}`}
          onClick={() => onChange(range)}
        >
          {PERIOD_LABELS[lang][range]}
        </button>
      ))}
    </div>
  );
}
