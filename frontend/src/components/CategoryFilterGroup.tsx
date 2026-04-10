import { CATEGORY_LABELS, I18N, type UiLang } from "../i18n";
import { CATEGORIES, type Category } from "../types/dashboard";

type Props = {
  value: Category[];
  onChange: (categories: Category[]) => void;
  lang?: UiLang;
};

export function CategoryFilterGroup({ value, onChange, lang = "en" }: Props) {
  const labels = CATEGORY_LABELS[lang];
  const t = I18N[lang];

  function toggleCategory(category: Category) {
    const exists = value.includes(category);
    if (exists) {
      onChange(value.filter((item) => item !== category));
      return;
    }

    onChange([...value, category]);
  }

  return (
    <div className="category-grid" role="group" aria-label={t.categoryFilters}>
      {CATEGORIES.map((category) => {
        const checked = value.includes(category);
        return (
          <label key={category} className={`chip ${checked ? "chip-on" : "chip-off"}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleCategory(category)}
              aria-label={labels[category]}
            />
            <span>{labels[category]}</span>
          </label>
        );
      })}
    </div>
  );
}
