import type { RangePreset } from "../types/dashboard";

const RANGES: RangePreset[] = ["7d", "30d", "90d", "all"];

type Props = {
  value: RangePreset;
  onChange: (range: RangePreset) => void;
};

export function RangeSelector({ value, onChange }: Props) {
  return (
    <div className="control-group" role="group" aria-label="Time range">
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          className={`button ${value === range ? "active" : "ghost"}`}
          onClick={() => onChange(range)}
        >
          {range}
        </button>
      ))}
    </div>
  );
}
