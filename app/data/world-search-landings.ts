import type { SearchMode } from "./search-taxonomy";
import { canonicalSearchLocation } from "../lib/geographic-names.ts";

const locationSlugs: Record<string, string> = {
  "צפון": "north",
  "חיפה": "haifa",
  "חיפה והכרמל": "haifa-carmel",
  "כנרת": "kinneret",
  "גליל מערבי": "western-galilee",
  "השרון": "sharon",
  "מישור החוף והשפלה": "coastal-plain",
  "מרכז": "center",
  "תל אביב": "tel-aviv",
  "תל אביב וגוש דן": "tel-aviv-area",
  "ראשון לציון": "rishon-lezion",
  "פתח תקווה": "petah-tikva",
  "רמת גן": "ramat-gan",
  "בת ים": "bat-yam",
  "הרצליה": "herzliya",
  "נתניה": "netanya",
  "רחובות": "rehovot",
  "אשדוד": "ashdod",
  "באר שבע": "beer-sheva",
  "ירושלים והסביבה": "jerusalem",
  "ים המלח": "dead-sea",
  "דרום ונגב": "south",
  "אילת והערבה": "eilat",
  "אילת והסביבה": "eilat",
};

export function searchLocationSlug(location: string) {
  return locationSlugs[canonicalSearchLocation(location)];
}

export function searchLocationFromSlug(mode: SearchMode, slug: string | undefined) {
  if (!slug) return undefined;
  // Route parsing must mirror route creation. A location can be offered by the
  // managed geography or live catalog even when it is not in a world's small
  // curated picker. Reject only slugs we never generate or recognize.
  void mode;
  return Object.entries(locationSlugs).find(([, candidate]) => candidate === slug)?.[0];
}

function locationHref(semanticBasePath: string, fallbackPath: string, location?: string) {
  if (!location || location === "הכל" || location === "כל הארץ") return fallbackPath;
  const canonical = canonicalSearchLocation(location);
  const slug = searchLocationSlug(canonical);
  return slug ? `${semanticBasePath}/${slug}` : `${fallbackPath}?location=${encodeURIComponent(canonical)}`;
}

export function mergeSearchHref(href: string, updates: URLSearchParams) {
  const [path, existing = ""] = href.split("?", 2);
  const params = new URLSearchParams(existing);
  updates.forEach((value, key) => params.set(key, value));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function eventSearchHref(location?: string) {
  return locationHref("/events/search", "/events/search", location);
}

export function eventBreadcrumbForLocation(area: string, location?: string) {
  const candidate = [area, location]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value && value !== "הכל" && value !== "כל הארץ"));

  return candidate
    ? { name: `מקומות לאירועים ב${canonicalSearchLocation(candidate)}`, path: eventSearchHref(candidate) }
    : { name: "מקומות לאירועים", path: "/events/search" };
}

export function hourlySearchHref(location?: string) {
  return locationHref("/hourly/search", "/hourly", location);
}

export function hourlyBreadcrumbForLocation(area: string, location?: string) {
  const candidate = [area, location]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value && value !== "הכל" && value !== "כל הארץ"));

  return candidate
    ? { name: `חדרים לפי שעה ב${canonicalSearchLocation(candidate)}`, path: hourlySearchHref(candidate) }
    : { name: "חדרים לפי שעה", path: "/hourly" };
}

export function hourlyBreadcrumbsForLocation(area: string, location?: string) {
  const values = [area, location]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value !== "הכל" && value !== "כל הארץ"));
  const distinct = [...new Set(values.map(canonicalSearchLocation))];
  return distinct.map((value) => ({ name: `חדרים לפי שעה ב${value}`, path: hourlySearchHref(value) }));
}
