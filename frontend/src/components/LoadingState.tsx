import { I18N, type UiLang } from "../i18n";

type Props = {
  message?: string;
  lang?: UiLang;
};

export function LoadingState({ message, lang = "en" }: Props) {
  const resolvedMessage = message ?? I18N[lang].loading;
  return <div className="state state-loading">{resolvedMessage}</div>;
}
