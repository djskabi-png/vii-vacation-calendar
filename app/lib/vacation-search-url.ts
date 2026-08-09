import { cleanAccommodationPath } from "../data/accommodation-landings";
import { cleanVacationPath } from "../data/vacation-landings";

type SearchUpdate = Record<string, string | null>;

export function buildVacationSearchUrl(currentSearch: string, updates: SearchUpdate, nextType: string, nextArea: string) {
  const params = new URLSearchParams(currentSearch);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null) params.delete(key);
    else params.set(key, value);
  });

  const cleanPath = nextType !== "הכל" ? cleanAccommodationPath(nextType, nextArea) : cleanVacationPath(nextArea);
  if (cleanPath) {
    params.delete("location");
    params.delete("type");
  } else {
    if (nextArea === "הכל" || nextArea === "כל הארץ") params.delete("location");
    else params.set("location", nextArea);
    if (nextType === "הכל") params.delete("type");
    else params.set("type", nextType);
  }

  if ((params.get("guests") || "2") === "2") params.delete("guests");
  const query = params.toString();
  const path = cleanPath || "/search";
  return query ? `${path}?${query}` : path;
}
