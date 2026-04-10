import { I18N, type UiLang } from "../i18n";

type Props = {
  url: string;
  lang?: UiLang;
};

export function ExportCsvButton({ url, lang = "en" }: Props) {
  const t = I18N[lang];

  return (
    <a className="button" href={url} download>
      {t.exportCsv}
    </a>
  );
}
