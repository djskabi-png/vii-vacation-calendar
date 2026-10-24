import type { SiteLanguage } from "./locale-routing";

const hebrewPattern = /[\u0590-\u05ff]/;

const hebrewTransliteration: Record<string, string> = {
  "א": "a", "ב": "b", "ג": "g", "ד": "d", "ה": "h", "ו": "v", "ז": "z", "ח": "kh", "ט": "t",
  "י": "y", "כ": "k", "ך": "kh", "ל": "l", "מ": "m", "ם": "m", "נ": "n", "ן": "n", "ס": "s",
  "ע": "a", "פ": "p", "ף": "f", "צ": "ts", "ץ": "ts", "ק": "k", "ר": "r", "ש": "sh", "ת": "t",
};

function transliterateHebrew(value: string) {
  const recognizable = value.replace(/לופט/g, "Loft");
  const transliterated = [...recognizable].map((character) => hebrewTransliteration[character] ?? character).join("")
    .replace(/[\u0590-\u05ff]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .trim();
  return transliterated && /[A-Za-zÀ-ÿ]/.test(transliterated)
    ? transliterated.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    : "";
}

export function localizedBusinessText(
  value: string | undefined | null,
  language: SiteLanguage,
  translate: (source: string) => string,
  fallback: string,
  stableFallback = false,
) {
  const source = value?.trim();
  if (!source) return fallback;
  if (language === "he") return source;
  if (stableFallback) return fallback;
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
  if (/[A-Za-zÀ-ÿ]{2}/.test(alias)) return alias;
  return transliterateHebrew(value);
}
