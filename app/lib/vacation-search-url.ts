import { cleanAccommodationPath } from "../data/accommodation-landings";
import { cleanVacationPath } from "../data/vacation-landings";

type SearchUpdate = Record<string, string | null>;

export function buildVacationSearchUrl(currentSearch: string, updates: SearchUpdate, nextTypes: string[], nextArea: string) {
  const params = new URLSearchParams(currentSearch);
  // `dates` was a localized display label in legacy URLs. It must never be
  // propagated into a shareable URL; exact and flexible searches use stable
  // machine-readable parameters instead.
  params.delete("dates");
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null) params.delete(key);
    else params.set(key, value);
  });

  const cleanPath = nextTypes.length === 1 ? cleanAccommodationPath(nextTypes[0], nextArea) : cleanVacationPath(nextArea);
  if (cleanPath) {
    params.delete("location");
    params.delete("type");
    if (nextTypes.length <= 1) params.delete("types");
    else params.set("types", nextTypes.join(","));
  } else {
    if (nextArea === "הכל" || nextArea === "כל הארץ") params.delete("location");
    else params.set("location", nextArea);
    params.delete("type");
    if (nextTypes.length) params.set("types", nextTypes.join(","));
    else params.delete("types");
  }

  if ((params.get("guests") || "2") === "2") params.delete("guests");
  const query = params.toString();
  const path = cleanPath || "/search";
  return query ? `${path}?${query}` : path;
}
