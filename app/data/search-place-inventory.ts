import { eventPlaceHref, eventPlaces, properties } from "./site-data";
import { hourlyPlaces, spaPlaces } from "./world-data";
import type { SearchMode } from "./search-taxonomy";

export type PlaceSearchResult = {
  id: string;
  name: string;
  location: string;
  area: string;
  kind: string;
  href: string;
};

export function searchPlaceInventory(mode: SearchMode): PlaceSearchResult[] {
  if (mode === "vacation") return properties.map((place) => ({ id: place.slug, name: place.name, location: place.location, area: place.area, kind: "מקום אירוח", href: `/business?id=${place.slug}` }));
  if (mode === "events") return eventPlaces.map((place) => ({ id: place.slug, name: place.name, location: place.location, area: place.area, kind: "מתחם אירועים", href: eventPlaceHref(place) }));
  const items = mode === "spa" ? spaPlaces : hourlyPlaces;
  return items.map((place) => ({ id: place.id, name: place.name, location: place.location, area: place.area, kind: mode === "spa" ? "בית ספא" : "חדר לפי שעה", href: `/discover/place/${place.id}` }));
}
