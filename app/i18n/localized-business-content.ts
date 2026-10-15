import type { SiteLanguage } from "./locale-routing";

const hebrewPattern = /[\u0590-\u05ff]/;

export function localizedBusinessText(
  value: string | undefined | null,
  language: SiteLanguage,
  translate: (source: string) => string,
  fallback: string,
) {
  const source = value?.trim();
  if (!source) return fallback;
  if (language === "he") return source;
  const translated = translate(source).trim();
  return translated && !hebrewPattern.test(translated) ? translated : fallback;
}

export function localizedBusinessList(
  values: Array<string | undefined | null>,
  language: SiteLanguage,
  translate: (source: string) => string,
) {
  if (language === "he") return values.filter((value): value is string => Boolean(value?.trim()));
  return [...new Set(values.flatMap((value) => {
    if (!value?.trim()) return [];
    const translated = translate(value).trim();
    return translated && !hebrewPattern.test(translated) ? [translated] : [];
  }))];
}

export function latinBusinessAlias(value: string) {
  const alias = value
    .replace(/[\u0590-\u05ff]+/g, " ")
    .replace(/[^A-Za-z0-9À-ÿ'&.+ -]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,|/-]+|[\s,|/-]+$/g, "")
    .trim();
  return /[A-Za-zÀ-ÿ]{2}/.test(alias) ? alias : "";
}
