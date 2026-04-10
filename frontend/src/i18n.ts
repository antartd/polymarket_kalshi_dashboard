import type { Category, RangePreset } from "./types/dashboard";

export type UiLang = "ru" | "en";

export const LANG_KEY = "pm-kalshi-lang";
export const DEFAULT_LANG: UiLang = "ru";

export const CATEGORY_LABELS: Record<UiLang, Record<Category, string>> = {
  ru: {
    sports: "Спорт",
    crypto: "Криптовалюты",
    politics: "Политика",
    geopolitics: "Геополитика",
    finance: "Финансы",
    culture: "Культура",
    tech_science: "Техника и наука",
    other: "Другое",
  },
  en: {
    sports: "Sports",
    crypto: "Crypto",
    politics: "Politics",
    geopolitics: "Geopolitics",
    finance: "Finance",
    culture: "Culture",
    tech_science: "Tech & Science",
    other: "Other",
  },
};

export const PERIOD_LABELS: Record<UiLang, Record<RangePreset, string>> = {
  ru: {
    "7d": "7Д",
    "30d": "30Д",
    "90d": "90Д",
    all: "Всё",
  },
  en: {
    "7d": "7D",
    "30d": "30D",
    "90d": "90D",
    all: "All",
  },
};

export const I18N: Record<
  UiLang,
  {
    noSyncYet: string;
    parity: string;
    total: string;
    edge: string;
    sourceDune: string;
    sourceLive: string;
    streamConnected: string;
    streamReconnecting: string;
    lastSnapshot: string;
    nextRefresh: string;
    hourly: string;
    lastUpdate: string;
    updating: string;
    loading: string;
    errorPrefix: string;
    pickCategory: string;
    lineChart: string;
    barChart: string;
    filter: string;
    categoryComparison: string;
    category: string;
    grandTotal: string;
    inCategory: string;
    ofOverall: string;
    ofTotalVolume: string;
    summary: string;
    volumesTitle: string;
    exportCsv: string;
    switchToLight: string;
    switchToDark: string;
    sourceSnapshot: string;
    sourceLiveApi: string;
    edgeDirection: string;
    toggleToEnglish: string;
    toggleToRussian: string;
    rangeControl: string;
    categoryFilters: string;
    periodDelta: string;
    current: string;
    previous: string;
    notAvailable: string;
    toggleTheme: string;
    darkUi: string;
    lightUi: string;
  }
> = {
  ru: {
    noSyncYet: "Ещё не синхронизировано",
    parity: "Паритет",
    total: "Сумма",
    edge: "Перевес",
    sourceDune: "Источник: Dune snapshot",
    sourceLive: "Источник: Live API",
    streamConnected: "подключен",
    streamReconnecting: "переподключение",
    lastSnapshot: "Последний снапшот",
    nextRefresh: "Следующее обновление",
    hourly: "каждый час",
    lastUpdate: "Последнее обновление",
    updating: "Обновление...",
    loading: "Загрузка данных дашборда...",
    errorPrefix: "Ошибка",
    pickCategory: "Выберите хотя бы одну категорию для отображения данных.",
    lineChart: "Линии",
    barChart: "Столбцы",
    filter: "Фильтр",
    categoryComparison: "Сравнение по категориям",
    category: "Категория",
    grandTotal: "Итого",
    inCategory: "в категории",
    ofOverall: "от общего",
    ofTotalVolume: "от общего объёма",
    summary: "Суммарно",
    volumesTitle: "Объёмы торгов · USD",
    exportCsv: "Экспорт CSV",
    switchToLight: "Переключить на светлую тему",
    switchToDark: "Переключить на тёмную тему",
    sourceSnapshot: "Dune Snapshot",
    sourceLiveApi: "Live API",
    edgeDirection: "Смещение",
    toggleToEnglish: "Switch language to English",
    toggleToRussian: "Переключить язык на русский",
    rangeControl: "Диапазон времени",
    categoryFilters: "Фильтры категорий",
    periodDelta: "Динамика период к периоду",
    current: "Текущий",
    previous: "Предыдущий",
    notAvailable: "Н/Д",
    toggleTheme: "Переключить тему",
    darkUi: "Тёмная тема",
    lightUi: "Светлая тема",
  },
  en: {
    noSyncYet: "No sync yet",
    parity: "Parity",
    total: "Total",
    edge: "Difference",
    sourceDune: "Source: Dune snapshot",
    sourceLive: "Source: Live API",
    streamConnected: "connected",
    streamReconnecting: "reconnecting",
    lastSnapshot: "Last snapshot",
    nextRefresh: "Next refresh",
    hourly: "hourly",
    lastUpdate: "Last update",
    updating: "Updating...",
    loading: "Loading dashboard data...",
    errorPrefix: "Error",
    pickCategory: "Pick at least one category to display data.",
    lineChart: "Lines",
    barChart: "Bars",
    filter: "Filter",
    categoryComparison: "Category comparison",
    category: "Category",
    grandTotal: "Total",
    inCategory: "in category",
    ofOverall: "of overall",
    ofTotalVolume: "of total volume",
    summary: "Summary",
    volumesTitle: "Trading volume · USD",
    exportCsv: "Export CSV",
    switchToLight: "Switch to light theme",
    switchToDark: "Switch to dark theme",
    sourceSnapshot: "Dune Snapshot",
    sourceLiveApi: "Live API",
    edgeDirection: "Direction",
    toggleToEnglish: "Switch language to English",
    toggleToRussian: "Switch language to Russian",
    rangeControl: "Time range",
    categoryFilters: "Category filters",
    periodDelta: "Period over period delta",
    current: "Current",
    previous: "Previous",
    notAvailable: "N/A",
    toggleTheme: "Toggle theme",
    darkUi: "Dark UI",
    lightUi: "Light UI",
  },
};

export function getInitialLang(): UiLang {
  const stored = localStorage.getItem(LANG_KEY);
  return stored === "en" || stored === "ru" ? stored : DEFAULT_LANG;
}

export function formatDateTime(value: string | null | undefined, lang: UiLang): string {
  if (!value) {
    return I18N[lang].noSyncYet;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(lang === "ru" ? "ru-RU" : "en-US");
}
