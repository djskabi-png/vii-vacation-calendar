import enTranslations from "../app/i18n/translations.en.generated.json";
import ruTranslations from "../app/i18n/translations.ru.generated.json";
import frTranslations from "../app/i18n/translations.fr.generated.json";
import hourlyUiTranslations from "../app/data/hourly-ui-translations.json";
import providerJoinTranslations from "../app/data/provider-join-translations.json";
import spaUiTranslations from "../app/data/spa-ui-translations.json";
import worldDepthTranslations from "../app/data/world-depth-translations.json";
import visitorUiTranslations from "../app/data/visitor-ui-translations.json";
import publicReviewTranslations from "../app/data/public-review-translations.json";
import { lookupPublicCopy } from "../app/i18n/public-copy";
import catalogAdminTranslations from "../app/data/catalog-admin-translations.json";
import { localizedSpaSearchSource } from "../app/data/spa-search-landings.ts";

const temporaryOrigin = "https://vii.spaplus.co";
const primaryOrigin = "https://www.vii.co.il";

export type PublicLocale = "he" | "en" | "ru" | "fr";
type TranslationDictionary = Record<string, string>;

const serverTranslations: Record<Exclude<PublicLocale, "he">, TranslationDictionary> = {
  en: { ...enTranslations, ...Object.fromEntries(Object.entries(hourlyUiTranslations).map(([key, value]) => [key, value.en])), ...Object.fromEntries(Object.entries(providerJoinTranslations).map(([key, value]) => [key, value.en])), ...Object.fromEntries(Object.entries(spaUiTranslations).map(([key, value]) => [key, value.en])), ...Object.fromEntries(Object.entries(catalogAdminTranslations).map(([key, value]) => [key, value.en])) },
  ru: { ...ruTranslations, ...Object.fromEntries(Object.entries(hourlyUiTranslations).map(([key, value]) => [key, value.ru])), ...Object.fromEntries(Object.entries(providerJoinTranslations).map(([key, value]) => [key, value.ru])), ...Object.fromEntries(Object.entries(spaUiTranslations).map(([key, value]) => [key, value.ru])), ...Object.fromEntries(Object.entries(catalogAdminTranslations).map(([key, value]) => [key, value.ru])) },
  fr: { ...frTranslations, ...Object.fromEntries(Object.entries(hourlyUiTranslations).map(([key, value]) => [key, value.fr])), ...Object.fromEntries(Object.entries(providerJoinTranslations).map(([key, value]) => [key, value.fr])), ...Object.fromEntries(Object.entries(spaUiTranslations).map(([key, value]) => [key, value.fr])), ...Object.fromEntries(Object.entries(catalogAdminTranslations).map(([key, value]) => [key, value.fr])) },
};

for (const locale of ["en", "ru", "fr"] as const) {
  Object.assign(serverTranslations[locale], Object.fromEntries(Object.entries(worldDepthTranslations).map(([key, value]) => [key, value[locale]])), Object.fromEntries(Object.entries(visitorUiTranslations).map(([key, value]) => [key, value[locale]])));
  Object.assign(serverTranslations[locale], Object.fromEntries(Object.entries(publicReviewTranslations).map(([key, value]) => [key, value[locale]])));
}

export function translateServerText(value: string, locale: PublicLocale) {
  if (locale === "he" || !/[\u0590-\u05ff]/.test(value)) return value;
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const core = value.slice(leading.length, value.length - trailing.length);
  if (!core) return value;
  // Metadata templates append the brand after the page title. Prefer the same
  // reviewed headline as the UI over an older machine-translated full string.
  const brandSuffix = " | וי פור ויקיישן";
  const headline = core.endsWith(brandSuffix) ? core.slice(0, -brandSuffix.length) : "";
  const reviewedHeadline = (visitorUiTranslations as Record<string, Partial<Record<PublicLocale, string>>>)[headline]?.[locale];
  if (reviewedHeadline) return `${leading}${reviewedHeadline} | ${serverTranslations[locale]["וי פור ויקיישן"] || "VII Vacation"}${trailing}`;
  const reviewedOrExact = lookupPublicCopy(core, locale, serverTranslations[locale]);
  if (reviewedOrExact) return `${leading}${reviewedOrExact}${trailing}`;
  if (headline) {
    const localizedHeadline = localizedSpaSearchSource(headline, locale) || serverTranslations[locale][headline];
    if (localizedHeadline) return `${leading}${localizedHeadline} | VII Vacation${trailing}`;
  }
  return `${leading}${localizedSpaSearchSource(core, locale) || serverTranslations[locale][core] || core}${trailing}`;
}

function localizeStructuredUrl(value: string, locale: Exclude<PublicLocale, "he">) {
  try {
    const url = new URL(value);
    if (url.origin !== "https://vii.spaplus.co") return value;
    if (/^\/(?:api|_next|assets|media|sitemaps)(?:\/|$)|^\/(?:favicon\.ico|robots\.txt|sitemap\.xml|feed\.xml|vii-logo\.png|og-v2\.png)$/.test(url.pathname)) return value;
    const basePath = url.pathname.replace(/^\/(en|ru|fr)(?=\/|$)/, "") || "/";
    url.pathname = `/${locale}${basePath === "/" ? "" : basePath}`;
    return url.toString();
  } catch {
    return value;
  }
}

export function localizeStructuredData(value: unknown, locale: Exclude<PublicLocale, "he">, key?: string, parentType?: string): unknown {
  if (key === "inLanguage") return locale;
  if (typeof value === "string") {
    const isPageUrl = ["@id", "mainEntityOfPage", "item", "urlTemplate"].includes(key || "")
      || (key === "url" && !["Organization", "WebSite", "ImageObject"].includes(parentType || ""));
    return translateServerText(isPageUrl ? localizeStructuredUrl(value, locale) : value, locale);
  }
  if (Array.isArray(value)) return value.map((item) => localizeStructuredData(item, locale, key, parentType));
  if (value && typeof value === "object") {
    const type = typeof (value as Record<string, unknown>)["@type"] === "string" ? (value as Record<string, string>)["@type"] : parentType;
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, localizeStructuredData(entryValue, locale, entryKey, type)]));
  }
  return value;
}

export function translateSeoHtml(html: string, locale: PublicLocale) {
  if (locale === "he") return html;
  return html
    .replace(/<title>([^<]*)<\/title>/g, (_match, value: string) => `<title>${translateServerText(value, locale)}</title>`)
    .replace(/<meta([^>]*?)content="([^"]*)"([^>]*)>/g, (_match, before: string, value: string, after: string) => {
      const translated = translateServerText(value, locale).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      return `<meta${before}content="${translated}"${after}>`;
    })
    .replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (match, value: string) => {
      try {
        return `<script type="application/ld+json">${JSON.stringify(localizeStructuredData(JSON.parse(value), locale))}</script>`;
      } catch {
        return match;
      }
    });
}

