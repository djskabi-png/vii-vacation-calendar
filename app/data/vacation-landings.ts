import { properties } from "./site-data";
import { isWholeCountrySelection, matchesSearchLocation } from "./search-taxonomy";

export type VacationRegion = {
  slug: string;
  label: string;
};

export const vacationRegions: VacationRegion[] = [
  { slug: "north", label: "צפון" },
  { slug: "kinneret", label: "כנרת" },
  { slug: "western-galilee", label: "גליל מערבי" },
  { slug: "haifa-carmel", label: "חיפה והכרמל" },
  { slug: "center", label: "מרכז" },
  { slug: "tel-aviv", label: "תל אביב" },
  { slug: "jerusalem", label: "ירושלים והסביבה" },
  { slug: "dead-sea", label: "ים המלח" },
  { slug: "south-negev", label: "דרום ונגב" },
  { slug: "eilat", label: "אילת והערבה" },
];

export function vacationRegionBySlug(slug?: string | null) {
  return slug ? vacationRegions.find((region) => region.slug === slug) : undefined;
}

export function vacationRegionByLabel(label?: string | null) {
  return label ? vacationRegions.find((region) => region.label === label) : undefined;
}

export function vacationRegionListings(region: VacationRegion) {
  return properties.filter((property) => matchesSearchLocation(property, region.label));
}

export function cleanVacationPath(location: string) {
  if (isWholeCountrySelection(location)) return null;
  const region = vacationRegionByLabel(location);
  return region && vacationRegionListings(region).length ? `/vacations/${region.slug}` : null;
}

export function vacationBreadcrumbForLocation(location: string) {
  const normalized = location.trim();
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

export function indexableVacationLandings() {
  return vacationRegions
    .map((region) => ({ region, listings: vacationRegionListings(region), path: `/vacations/${region.slug}` }))
    .filter((landing) => landing.listings.length > 0);
}
