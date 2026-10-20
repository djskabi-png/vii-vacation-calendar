import { headers } from "next/headers";
import visitor from "../data/visitor-ui-translations.json";
import reviewed from "../data/public-review-translations.json";
import { lookupPublicCopy } from "./public-copy";
import type { SiteLanguage } from "./locale-routing";
import { localizedPath } from "./locale-routing";

export async function serverLocalePath(path: string) {
  const raw = (await headers()).get("x-vii-locale");
  const language: SiteLanguage = raw === "en" || raw === "fr" || raw === "ru" ? raw : "he";
  return localizedPath(path, language);
}

export async function serverPublicCopy() {
  const raw = (await headers()).get("x-vii-locale");
  const language: SiteLanguage = raw === "en" || raw === "fr" || raw === "ru" ? raw : "he";
  const generated = language === "he" ? {} : (await (language === "en" ? import("./translations.en.generated.json") : language === "fr" ? import("./translations.fr.generated.json") : import("./translations.ru.generated.json"))).default as Record<string, string>;
  const dictionary: Record<string, string> = { ...generated };
  for (const bundle of [visitor, reviewed]) for (const [source, translations] of Object.entries(bundle)) {
    const value = (translations as Partial<Record<SiteLanguage, string>>)[language];
    if (value) dictionary[source] = value;
  }
  return { language, translate: (value: string) => lookupPublicCopy(value, language, dictionary) || value };
}
