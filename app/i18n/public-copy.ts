import type { SiteLanguage } from "./locale-routing";

const indexes = new WeakMap<Record<string, string>, Map<string, string>>();
const normalize = (value: string) => value.trim().replace(/\s+/g, " ").replace(/\s+[-–—]\s+|,\s*/g, ", ");

// Resolve only reviewed dictionary entries. Punctuation variants are aliases,
// not permission to translate an unknown name or change its identity.
export function lookupPublicCopy(value: string, language: SiteLanguage, dictionary: Record<string, string>): string | undefined {
  if (language === "he" || !/[\u0590-\u05ff]/.test(value)) return value;
  const core = value.trim().replace(/\s+/g, " ");
  if (dictionary[core]) return dictionary[core];
  let index = indexes.get(dictionary);
  if (!index) { index = new Map(Object.entries(dictionary).map(([source, text]) => [normalize(source), text])); indexes.set(dictionary, index); }
  const alias = index.get(normalize(core));
  if (alias) return alias;
  const brandSuffix = " | וי פור ויקיישן";
  if (core.endsWith(brandSuffix)) {
    const headline = lookupPublicCopy(core.slice(0, -brandSuffix.length), language, dictionary);
    const brand = dictionary["וי פור ויקיישן"];
    if (headline && brand && !/[\u0590-\u05ff]/.test(headline + brand)) return `${headline} | ${brand}`;
  }
  const parts = core.split(" | ");
  if (parts.length > 1) {
    const translated = parts.map((part) => lookupPublicCopy(part, language, dictionary));
    if (translated.every((part) => part && !/[\u0590-\u05ff]/.test(part))) return translated.join(" | ");
  }
  const when = core.match(/^מתי (.+) (\d{4})\?$/);
  const find = core.match(/^איך מוצאים מקום פנוי ל(.+)\?$/);
  const questions = core.match(/^שאלות על נופש ב(.+)$/);
  const sourceName = when?.[1] || find?.[1] || questions?.[1];
  const name = sourceName ? dictionary[sourceName] : undefined;
  if (name && !/[\u0590-\u05ff]/.test(name)) {
    if (when) return language === "en" ? `When is ${name} ${when[2]}?` : language === "fr" ? `Quelles sont les dates de ${name} en ${when[2]} ?` : `Когда ${name} в ${when[2]} году?`;
    if (questions) return language === "en" ? `Questions about stays for ${name}` : language === "fr" ? `Questions sur les séjours pour ${name}` : `Вопросы об отдыхе на ${name}`;
    return language === "en" ? `How can I find an available stay for ${name}?` : language === "fr" ? `Comment trouver un hébergement disponible pour ${name} ?` : `Как найти свободное жильё на ${name}?`;
  }
  return undefined;
}
