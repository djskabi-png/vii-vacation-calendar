export type SiteLanguage = "he" | "en" | "ru" | "fr";

export const localizedLanguages = ["en", "ru", "fr"] as const;

const localePrefix = /^\/(en|ru|fr)(?=\/|$)/;
const nonPagePath = /^\/(?:api|_next|media)(?:\/|$)|^\/(?:favicon\.ico|robots\.txt|sitemap\.xml|feed\.xml|vii-logo\.png|og-v2\.png)$/;

export function languageFromPathname(pathname: string): SiteLanguage {
  const match = pathname.match(localePrefix);
  return match ? match[1] as SiteLanguage : "he";
}

export function stripLanguagePrefix(pathname: string) {
  const stripped = pathname.replace(localePrefix, "");
  return stripped || "/";
}

export function localizedPath(pathname: string, language: SiteLanguage) {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return pathname;
  const hashIndex = pathname.indexOf("#");
  const hash = hashIndex >= 0 ? pathname.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? pathname.slice(0, hashIndex) : pathname;
  const queryIndex = withoutHash.indexOf("?");
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const rawPath = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  if (nonPagePath.test(rawPath)) return pathname;
  const basePath = stripLanguagePrefix(rawPath);
  const localized = language === "he" ? basePath : `/${language}${basePath === "/" ? "" : basePath}`;
  return `${localized}${query}${hash}`;
}
