import type { SiteLanguage } from "../i18n/locale-provider";

export type MapPriceMode = "from" | "nightly" | "stay_total";

export type MapPriceQuote = {
  amount: number;
  mode: MapPriceMode;
};

const localeByLanguage: Record<SiteLanguage, string> = {
  he: "he-IL",
  en: "en-US",
  ru: "ru-RU",
  fr: "fr-FR",
};

const prefixByLanguage: Record<SiteLanguage, Record<MapPriceMode, string>> = {
  he: { from: "החל מ־", nightly: "ללילה ", stay_total: "לשהייה " },
  en: { from: "From ", nightly: "Night ", stay_total: "Stay " },
  ru: { from: "От ", nightly: "Ночь ", stay_total: "За проживание " },
  fr: { from: "Dès ", nightly: "Nuit ", stay_total: "Séjour " },
};

export function validMapPrice(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0;
}

export function formatMapPrice(quote: MapPriceQuote, language: SiteLanguage, compact = true) {
  if (!validMapPrice(quote.amount)) return "";
  const amount = Math.round(quote.amount).toLocaleString(localeByLanguage[language]);
  if (compact) return `₪${amount}`;
  return `${prefixByLanguage[language][quote.mode]}₪${amount}`;
}

/**
 * Discovery priceLabel is accepted public display data. Still require an
 * explicit currency token so a duration, capacity or date can never become a
 * map price merely because it contains digits.
 */
export function verifiedPriceFromLabel(label: string | undefined): number | null {
  if (!label || !/(?:₪|ש["״']?ח|ILS)/i.test(label)) return null;
  const candidates = [...label.matchAll(/\d[\d,.]*/g)]
    .map((match) => Number(match[0].replace(/,/g, "")))
    .filter(validMapPrice);
  return candidates.length ? candidates[0] : null;
}

export function priceModeFromLabel(label: string | undefined): MapPriceMode {
  if (!label) return "from";
  if (/לשהייה|סה["״']?כ|total|séjour|проживан/i.test(label)) return "stay_total";
  if (/לילה|night|nuit|ноч/i.test(label)) return "nightly";
  return "from";
}
