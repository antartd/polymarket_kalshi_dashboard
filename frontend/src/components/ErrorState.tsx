import { I18N, type UiLang } from "../i18n";

type Props = {
  message: string;
  prefix?: string;
  lang?: UiLang;
};

export function ErrorState({ message, prefix, lang = "en" }: Props) {
  const resolvedPrefix = prefix ?? I18N[lang].errorPrefix;
  return <div className="state state-error">{resolvedPrefix}: {message}</div>;
}
