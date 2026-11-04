import type { Property } from "./site-data";
import { isWholeCountrySelection, matchesSearchLocation } from "./search-taxonomy.ts";
import { canonicalSearchLocation } from "../lib/geographic-names.ts";
import { worldLocationPath } from "../lib/world-location-pages.ts";

export type VacationRegion = {
  slug: string;
  label: string;
};

export type VacationGeoLink = {
  label: string;
  path: string;
  count: number;
};

export type VacationRegionHierarchy = {
  region: VacationRegion;
  subregions: VacationGeoLink[];
  towns: VacationGeoLink[];
};

export const vacationRegions: VacationRegion[] = [
  { slug: "north", label: "צפון" },
  { slug: "kinneret", label: "כנרת" },
  { slug: "western-galilee", label: "גליל מערבי" },
  { slug: "haifa-carmel", label: "חיפה והכרמל" },
  { slug: "center", label: "מרכז" },
  { slug: "tel-aviv", label: "תל אביב" },
  { slug: "tel-aviv-area", label: "תל אביב וגוש דן" },
  { slug: "jerusalem", label: "ירושלים והסביבה" },
  { slug: "dead-sea", label: "ים המלח" },
  { slug: "south-negev", label: "דרום ונגב" },
  { slug: "eilat", label: "אילת והערבה" },
];

export function vacationRegionBySlug(slug?: string | null) {
  return slug ? vacationRegions.find((region) => region.slug === slug) : undefined;
}

export function vacationRegionByLabel(label?: string | null) {
  return label ? vacationRegions.find((region) => region.label === canonicalSearchLocation(label)) : undefined;
}

export function vacationRegionListings(region: VacationRegion, inventory: Property[]) {
  return inventory.filter((property) => matchesSearchLocation(property, region.label));
}

function catalogGeoLinks(values: readonly string[], pathFor: (value: string) => string): VacationGeoLink[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = canonicalSearchLocation(value);
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, path: pathFor(label) }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "he"));
}

/**
 * Builds the visible region hierarchy from the currently published catalog.
 * No city or subregion is invented here: a link exists only when the catalog
 * represents it inside the selected region.
 */
export function vacationRegionHierarchy(region: VacationRegion, inventory: Property[]): VacationRegionHierarchy {
  const listings = vacationRegionListings(region, inventory);
  return {
    region,
    subregions: catalogGeoLinks(listings.map((property) => property.area), (label) => worldLocationPath("vacation", label)).filter((item) => item.label !== canonicalSearchLocation(region.label)),
    towns: catalogGeoLinks(listings.map((property) => property.location), (label) => worldLocationPath("vacation", label)),
  };
}

export function vacationBreadcrumbTrail(location: string, inventory: Property[] = []) {
  const normalized = canonicalSearchLocation(location);
  const region = vacationRegions.find((item) => item.label === normalized)
    || vacationRegions.find((item) => matchesSearchLocation({ area: normalized, location: normalized } as Property, item.label))
    || vacationRegions.find((item) => vacationRegionListings(item, inventory).some((property) => canonicalSearchLocation(property.area) === normalized || canonicalSearchLocation(property.location) === normalized));
  if (!region) return [{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, { name: `נופש ב${normalized}`, path: worldLocationPath("vacation", normalized) }];
  const links = vacationRegionHierarchy(region, inventory);
  const town = links.towns.find((item) => item.label === normalized);
  const parentArea = town ? vacationRegionListings(region, inventory).find((property) => canonicalSearchLocation(property.location) === normalized)?.area : undefined;
  const subregion = links.subregions.find((item) => item.label === normalized || parentArea && item.label === canonicalSearchLocation(parentArea));
  return [
    { name: "ראשי", path: "/" },
    { name: "נופש", path: "/search" },
    { name: `נופש ב${region.label}`, path: `/vacations/${region.slug}` },
    ...(subregion ? [{ name: subregion.label, path: subregion.path }] : []),
    ...(town ? [{ name: town.label, path: town.path }] : []),
  ];
}

export function vacationBreadcrumbTrailForProperty(property: Pick<Property, "area" | "location">, inventory: Property[] = []) {
  const region = vacationRegions.find((item) => vacationRegionListings(item, inventory).some((candidate) => candidate === property || (candidate.area === property.area && candidate.location === property.location)))
    || vacationRegions.find((item) => matchesSearchLocation(property as Property, item.label));
  if (!region) return vacationBreadcrumbTrail(property.location || property.area, inventory);
  const hierarchy = vacationRegionHierarchy(region, inventory);
  const subregion = hierarchy.subregions.find((item) => item.label === canonicalSearchLocation(property.area));
  const town = hierarchy.towns.find((item) => item.label === canonicalSearchLocation(property.location));
  return [
    { name: "ראשי", path: "/" },
    { name: "נופש", path: "/search" },
    { name: `נופש ב${region.label}`, path: `/vacations/${region.slug}` },
    ...(subregion ? [{ name: subregion.label, path: subregion.path }] : []),
    ...(town ? [{ name: town.label, path: town.path }] : []),
  ];
}

export function cleanVacationPath(location: string, inventory?: Property[]) {
  if (isWholeCountrySelection(location)) return null;
  const region = vacationRegionByLabel(location);
  if (region && (!inventory || vacationRegionListings(region, inventory).length)) return `/vacations/${region.slug}`;
  return worldLocationPath("vacation", location);
}

export function vacationBreadcrumbForLocation(location: string, inventory: Property[] = []) {
  const normalized = location.trim();
  const representedSubregion = vacationRegions
    .flatMap((region) => vacationRegionHierarchy(region, inventory).subregions)
    .find((item) => item.label === canonicalSearchLocation(normalized));
  if (representedSubregion) return { name: `נופש ב${representedSubregion.label}`, path: representedSubregion.path };
  const region = vacationRegions.find((item) => item.label === normalized)
    || (normalized.includes("כנרת") ? vacationRegionBySlug("kinneret") : undefined)
    || (normalized.includes("גליל מערבי") ? vacationRegionBySlug("western-galilee") : undefined)
    || (normalized.includes("גליל") || normalized === "צפון" ? vacationRegionBySlug("north") : undefined)
    || (normalized.includes("חיפה") || normalized.includes("כרמל") ? vacationRegionBySlug("haifa-carmel") : undefined)
    || (normalized.includes("ירושלים") || normalized.includes("יהודה") ? vacationRegionBySlug("jerusalem") : undefined)
    || (normalized.includes("אילת") || normalized.includes("ערבה") ? vacationRegionBySlug("eilat") : undefined)
    || (normalized.includes("דרום") || normalized.includes("נגב") ? vacationRegionBySlug("south-negev") : undefined)
    || (normalized.includes("מרכז") || normalized.includes("מישור החוף") ? vacationRegionBySlug("center") : undefined);

  return region
    ? { name: `נופש ב${region.label}`, path: `/vacations/${region.slug}` }
    : { name: `נופש ב${normalized}`, path: `/search?location=${encodeURIComponent(normalized)}` };
}

export function indexableVacationLandings(inventory: Property[]) {
  return vacationRegions
    .map((region) => ({ region, listings: vacationRegionListings(region, inventory), path: `/vacations/${region.slug}` }))
    .filter((landing) => landing.listings.length > 0);
}
