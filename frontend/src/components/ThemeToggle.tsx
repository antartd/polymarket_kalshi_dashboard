import { I18N, type UiLang } from "../i18n";

type Props = {
  dark: boolean;
  onToggle: () => void;
  lang?: UiLang;
};

export function ThemeToggle({ dark, onToggle, lang = "en" }: Props) {
  const t = I18N[lang];
  return (
    <button type="button" className="button ghost" onClick={onToggle} aria-label={t.toggleTheme}>
      {dark ? t.lightUi : t.darkUi}
    </button>
  );
}
