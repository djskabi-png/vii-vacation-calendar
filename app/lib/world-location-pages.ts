import { canonicalSearchLocation, uniqueSearchLocations } from "./geographic-names.ts";
import { publicCatalogSummaries } from "./public-catalog-read.ts";
import { isWholeCountrySelection, searchLocationOptions, type SearchMode } from "../data/search-taxonomy.ts";
import { worldLocationSlug } from "./location-slug.ts";
import approvedLocations from "../data/approved-world-locations.json" with { type: "json" };

type CatalogLocation = {
  area?: string;
  location?: string;
  city?: string;
};

const catalogWorld: Record<SearchMode, "vacations" | "events" | "spa" | "rooms"> = {
  vacation: "vacations",
  events: "events",
  spa: "spa",
  hourly: "rooms",
};

const basePath: Record<SearchMode, string> = {
  vacation: "/vacations/search",
  events: "/events/search",
  spa: "/spas/search",
  hourly: "/hourly/search",
};

export { worldLocationSlug };

export function worldLocationPath(mode: SearchMode, label: string) {
  return `${basePath[mode]}/${worldLocationSlug(label)}`;
}

export async function worldLocationInventory(mode: SearchMode) {
  const entries = await publicCatalogSummaries<CatalogLocation>(catalogWorld[mode]);
  const values = entries.flatMap((entry) => mode === "spa"
    ? [entry.city || ""]
    : [entry.area || "", entry.location || ""]);
  return uniqueSearchLocations([...approvedLocations[mode], ...values.filter(Boolean)])
    .map((label) => ({ label, slug: worldLocationSlug(label), path: worldLocationPath(mode, label) }))
    .sort((left, right) => left.label.localeCompare(right.label, "he"));
}

export function approvedSearchLocationFromSlug(mode: SearchMode, slug: string) {
  const match = uniqueSearchLocations([...approvedLocations[mode], ...searchLocationOptions(mode)])
    .filter((label) => !isWholeCountrySelection(label))
    .find((label) => worldLocationSlug(label) === slug);
  return match || null;
}

export async function approvedWorldLocation(mode: SearchMode, slug: string) {
  const approvedLabel = approvedSearchLocationFromSlug(mode, slug);
  if (approvedLabel) return { label: approvedLabel, slug, path: worldLocationPath(mode, approvedLabel) };
  return (await worldLocationInventory(mode)).find((entry) => entry.slug === slug) || null;
}

export async function approvedWorldLocationForLabel(mode: SearchMode, label: string) {
  const canonical = canonicalSearchLocation(label);
  const approvedLabel = uniqueSearchLocations([...approvedLocations[mode], ...searchLocationOptions(mode)])
    .filter((candidate) => !isWholeCountrySelection(candidate))
    .find((candidate) => canonicalSearchLocation(candidate) === canonical);
  if (approvedLabel) return { label: approvedLabel, slug: worldLocationSlug(approvedLabel), path: worldLocationPath(mode, approvedLabel) };
  return (await worldLocationInventory(mode)).find((entry) => entry.label === canonical) || null;
}

