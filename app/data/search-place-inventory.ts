import type { SearchMode } from "./search-taxonomy";
import { spaPlusArea } from "./spa-regions.ts";

export type PlaceSearchResult = {
  id: string;
  name: string;
  location: string;
  area: string;
  kind: string;
  href: string;
};

type CatalogPlace = {
  id?: string | number;
  slug?: string;
  title?: string;
  name?: string;
  city?: string;
  location?: string;
  area?: string;
  sourcePropertySlug?: string;
};

export function searchPlaceInventory(mode: SearchMode, entries: unknown[]): PlaceSearchResult[] {
  return entries.flatMap((entry) => {
    const place = entry as CatalogPlace;
    const id = mode === "spa" ? `spa-${place.id}` : mode === "hourly" ? String(place.id || "") : place.slug || "";
    const name = mode === "spa" ? place.title || "" : place.name || "";
    if (!id || !name) return [];
    const location = mode === "spa" ? place.city || "" : place.location || "";
    const href = mode === "vacation" ? `/business?id=${id}`
      : mode === "events" ? place.sourcePropertySlug ? `/business?id=${place.sourcePropertySlug}&mode=events` : `/events/place/${id}`
      : `/discover/place/${id}`;
    return [{ id, name, location, area: mode === "spa" ? spaPlusArea(location) : place.area || "",
      kind: mode === "vacation" ? "מקום אירוח" : mode === "events" ? "מתחם אירועים" : mode === "spa" ? "בית ספא" : "חדר לפי שעה", href }];
  });
}
