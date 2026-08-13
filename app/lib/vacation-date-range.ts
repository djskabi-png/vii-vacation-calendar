import type { SiteLanguage } from "../i18n/locale-routing";

export type VacationStay = { from: string; till: string };

type SearchParamsReader = { get(name: string): string | null };

const supportedLanguages: SiteLanguage[] = ["he", "en", "ru", "fr"];

function normalizeDateText(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[\u200e\u200f]/g, "")
    .replace(/[׳'’.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function validIsoDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}

function monthAliases(language: SiteLanguage, year: number) {
  const locale = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" }[language];
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, index, 1, 12));
    return {
      month: index + 1,
      names: ["short", "long"].map((style) => normalizeDateText(new Intl.DateTimeFormat(locale, { month: style as "short" | "long" }).format(date))),
    };
  });
}

function parseLocalizedDatePart(value: string, language: SiteLanguage, year: number) {
  const normalized = normalizeDateText(value);
  const day = Number(normalized.match(/\d{1,2}/)?.[0]);
  const month = monthAliases(language, year).find((entry) => entry.names.some((name) => name && normalized.includes(name)))?.month;
  if (!day || !month) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day, 12));
  if (candidate.getUTCDate() !== day || candidate.getUTCMonth() !== month - 1) return null;
  return candidate;
}

function parseDisplayLabel(value: string, preferredLanguage: SiteLanguage, year: number): VacationStay | null {
  const languages = [preferredLanguage, ...supportedLanguages.filter((language) => language !== preferredLanguage)];
  const separators: Record<SiteLanguage, RegExp> = {
    he: /\s+עד\s+/,
    en: /\s+to\s+/i,
    ru: /\s+по\s+/i,
    fr: /\s+au\s+/i,
  };

  for (const language of languages) {
    const parts = value.split(separators[language]);
    if (parts.length !== 2) continue;
    const arrival = parseLocalizedDatePart(parts[0], language, year);
    let departure = parseLocalizedDatePart(parts[1], language, year);
    if (!arrival || !departure) continue;
    if (departure <= arrival) departure = new Date(Date.UTC(year + 1, departure.getUTCMonth(), departure.getUTCDate(), 12));
    return { from: arrival.toISOString().slice(0, 10), till: departure.toISOString().slice(0, 10) };
  }
  return null;
}

export function vacationStayFromSearch(searchParams: SearchParamsReader, language: SiteLanguage, year = new Date().getFullYear()): VacationStay | null {
  const from = searchParams.get("from");
  const till = searchParams.get("till");
  if (validIsoDate(from) && validIsoDate(till) && from! < till!) return { from: from!, till: till! };

  const displayLabel = searchParams.get("dates");
  return displayLabel ? parseDisplayLabel(displayLabel, language, year) : null;
}
