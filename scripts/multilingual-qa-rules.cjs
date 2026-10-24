"use strict";

const HEBREW = /[\u0590-\u05ff]/;
const CYRILLIC = /[\u0400-\u04ff]/;
const RAW_ISO_DATE = /\b20\d{2}-\d{2}-\d{2}\b/;

const rejectedCopy = {
  fr: [
    /\bquand sors-tu\b/i,
    /\bqui vient\b/i,
    /\bDes idées qui continuent les vacances\b/i,
    /\bSéjours à l'heure\b/i,
    /\bPour tous les articles\b/i,
    /\bPour les détails du lieu\b/i,
  ],
  en: [],
  ru: [],
  he: [],
};

function analyzeTextSamples(samples, locale) {
  const problems = [];
  for (const sample of samples) {
    const text = String(sample.text || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (locale !== "he" && HEBREW.test(text)) problems.push({ kind: "locale_script_leak", ...sample, text });
    if ((locale === "en" || locale === "fr") && CYRILLIC.test(text)) problems.push({ kind: "locale_script_leak", ...sample, text });
    if (locale !== "he" && RAW_ISO_DATE.test(text)) problems.push({ kind: "unlocalized_date", ...sample, text });
    const rejected = (rejectedCopy[locale] || []).find((pattern) => pattern.test(text));
    if (rejected) problems.push({ kind: "rejected_literal_copy", ...sample, text });
  }
  return problems;
}

function intersectionRatio(a, b) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const overlap = width * height;
  const area = Math.max(1, (a.right - a.left) * (a.bottom - a.top));
  return overlap / area;
}

function findProhibitedCollisions(headings, surfaces, threshold = 0.06) {
  const collisions = [];
  for (const heading of headings) {
    for (const surface of surfaces) {
      if (heading.elementId === surface.elementId || heading.contains?.includes(surface.elementId) || surface.contains?.includes(heading.elementId)) continue;
      const ratio = intersectionRatio(heading.rect, surface.rect);
      if (ratio > threshold) collisions.push({ kind: "visual_collision", heading, surface, ratio: Number(ratio.toFixed(4)) });
    }
  }
  return collisions;
}

function localizedRoute(route, locale) {
  if (locale === "he") return route;
  const [pathAndQuery, hash = ""] = route.split("#", 2);
  const queryIndex = pathAndQuery.indexOf("?");
  const path = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery;
  const query = queryIndex >= 0 ? pathAndQuery.slice(queryIndex) : "";
  return `/${locale}${path === "/" ? "" : path}${query}${hash ? `#${hash}` : ""}`;
}

function hasLocalePath(url, locale) {
  if (!url) return false;
  const pathname = new URL(url, "https://vii.spaplus.co").pathname.replace(/\/+$/, "") || "/";
  if (locale === "he") return !/^\/(?:en|ru|fr)(?:\/|$)/.test(pathname);
  return pathname === `/${locale}` || pathname.startsWith(`/${locale}/`);
}

function analyzeLocaleSeo({ currentUrl, canonical, ogUrl, alternates = [] }, locale) {
  const problems = [];
  if (!hasLocalePath(currentUrl, locale)) problems.push({ kind: "locale_url_not_unique", locale, currentUrl });
  if (!canonical) problems.push({ kind: "canonical_missing", locale, currentUrl });
  else if (!hasLocalePath(canonical, locale)) problems.push({ kind: "canonical_locale_mismatch", locale, currentUrl, canonical });
  if (!ogUrl) problems.push({ kind: "share_url_missing", locale, currentUrl });
  else if (!hasLocalePath(ogUrl, locale)) problems.push({ kind: "share_url_locale_mismatch", locale, currentUrl, ogUrl });

  const expected = { "he-IL": "he", en: "en", ru: "ru", fr: "fr", "x-default": "he" };
  const byLanguage = new Map(alternates.map((item) => [String(item.hreflang || "").toLowerCase(), item.href]));
  for (const [hreflang, expectedLocale] of Object.entries(expected)) {
    const href = byLanguage.get(hreflang.toLowerCase());
    if (!href) problems.push({ kind: "hreflang_missing", locale, hreflang, currentUrl });
    else if (!hasLocalePath(href, expectedLocale)) problems.push({ kind: "hreflang_locale_mismatch", locale, hreflang, href, currentUrl });
  }
  const localizedHrefs = ["he-il", "en", "ru", "fr"].map((key) => byLanguage.get(key)).filter(Boolean);
  if (new Set(localizedHrefs).size !== localizedHrefs.length) problems.push({ kind: "hreflang_urls_not_unique", locale, currentUrl });
  return problems;
}

module.exports = { analyzeLocaleSeo, analyzeTextSamples, findProhibitedCollisions, hasLocalePath, intersectionRatio, localizedRoute };
