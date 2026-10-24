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

module.exports = { analyzeTextSamples, findProhibitedCollisions, intersectionRatio, localizedRoute };
