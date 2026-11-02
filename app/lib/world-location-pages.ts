import { canonicalSearchLocation, uniqueSearchLocations } from "./geographic-names.ts";
import { publicCatalogSummaries } from "./public-catalog-read.ts";
import type { SearchMode } from "../data/search-taxonomy.ts";
import { worldLocationSlug } from "./location-slug.ts";

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
  return uniqueSearchLocations(values.filter(Boolean))
    .map((label) => ({ label, slug: worldLocationSlug(label), path: worldLocationPath(mode, label) }))
    .sort((left, right) => left.label.localeCompare(right.label, "he"));
}

export async function approvedWorldLocation(mode: SearchMode, slug: string) {
  return (await worldLocationInventory(mode)).find((entry) => entry.slug === slug) || null;
}

export async function approvedWorldLocationForLabel(mode: SearchMode, label: string) {
  const canonical = canonicalSearchLocation(label);
  return (await worldLocationInventory(mode)).find((entry) => entry.label === canonical) || null;
}

