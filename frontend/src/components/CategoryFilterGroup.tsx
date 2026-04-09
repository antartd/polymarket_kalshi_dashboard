import { CATEGORIES, type Category } from "../types/dashboard";

const LABELS: Record<Category, string> = {
  sports: "Sports",
  crypto: "Crypto",
  politics: "Politics",
  geopolitics: "Geopolitics",
  finance: "Finance",
  culture: "Culture",
  tech_science: "Tech & Science",
  other: "Other",
};

type Props = {
  value: Category[];
  onChange: (categories: Category[]) => void;
};

export function CategoryFilterGroup({ value, onChange }: Props) {
  function toggleCategory(category: Category) {
    const exists = value.includes(category);
    if (exists) {
      onChange(value.filter((item) => item !== category));
      return;
    }

    onChange([...value, category]);
  }

  return (
    <div className="category-grid" role="group" aria-label="Category filters">
      {CATEGORIES.map((category) => {
        const checked = value.includes(category);
        return (
          <label key={category} className={`chip ${checked ? "chip-on" : "chip-off"}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleCategory(category)}
              aria-label={LABELS[category]}
            />
            <span>{LABELS[category]}</span>
          </label>
        );
      })}
    </div>
  );
}
