import type { SearchMode } from "./search-taxonomy";
import { searchLocationOptions } from "./search-taxonomy";

const locationSlugs: Record<string, string> = {
  "צפון": "north",
  "חיפה": "haifa",
  "חיפה והכרמל": "haifa-carmel",
  "כנרת": "kinneret",
  "גליל מערבי": "western-galilee",
  "השרון": "sharon",
  "מרכז": "center",
  "תל אביב": "tel-aviv",
  "ירושלים והסביבה": "jerusalem",
  "ים המלח": "dead-sea",
  "דרום ונגב": "south",
  "אילת והערבה": "eilat",
  "אילת והסביבה": "eilat",
};

export function searchLocationSlug(location: string) {
  return locationSlugs[location];
}

export function searchLocationFromSlug(mode: SearchMode, slug: string | undefined) {
  if (!slug) return undefined;
  return searchLocationOptions(mode).find((location) => locationSlugs[location] === slug);
}

export function eventSearchHref(location?: string) {
  const slug = location && location !== "הכל" && location !== "כל הארץ" ? searchLocationSlug(location) : undefined;
  return slug ? `/events/search/${slug}` : "/events/search";
}

export function hourlySearchHref(location?: string) {
  const slug = location && location !== "הכל" && location !== "כל הארץ" ? searchLocationSlug(location) : undefined;
  return slug ? `/hourly/search/${slug}` : "/hourly";
}
