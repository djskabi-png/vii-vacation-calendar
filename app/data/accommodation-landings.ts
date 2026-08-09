import { properties, type Property } from "./site-data";

export type AccommodationCategoryId = "villas" | "suite-complexes" | "luxury-suites" | "vacation-apartments";

export type AccommodationCategory = {
  id: AccommodationCategoryId;
  path: string;
  propertyTypes: string[];
  title: string;
  singular: string;
  countOne: string;
  description: string;
  footerTopic: "vacation-villas" | "suite-complexes" | "luxury-suites" | "vacation-apartments";
};

export type AccommodationRegion = {
  slug: string;
  label: string;
  matches: (property: Property) => boolean;
};

export const accommodationCategories: AccommodationCategory[] = [
  {
    id: "villas",
    path: "/villas",
    propertyTypes: ["וילה"],
    title: "וילות נופש",
    singular: "וילה",
    countOne: "וילת נופש אחת",
    description: "וילות נופש פעילות עם תמונות מלאות, פרטי חדרים, מתקנים ואפשרויות הזמנה במקום אחד.",
    footerTopic: "vacation-villas",
  },
  {
    id: "suite-complexes",
    path: "/suite-complexes",
    propertyTypes: ["מתחם סוויטות", "סוויטות", "מתחם נופש"],
    title: "מתחמי סוויטות",
    singular: "מתחם סוויטות",
    countOne: "מתחם סוויטות אחד",
    description: "מתחמי סוויטות פעילים למשפחות, זוגות וקבוצות, עם מידע מלא על היחידות והמתקנים.",
    footerTopic: "suite-complexes",
  },
  {
    id: "luxury-suites",
    path: "/luxury-suites",
    propertyTypes: ["סוויטות יוקרה"],
    title: "סוויטות יוקרה",
    singular: "סוויטת יוקרה",
    countOne: "סוויטת יוקרה אחת",
    description: "סוויטות יוקרה פעילות עם פרטיות, מתקנים איכותיים ומידע מלא לבחירה בטוחה.",
    footerTopic: "luxury-suites",
  },
  {
    id: "vacation-apartments",
    path: "/vacation-apartments",
    propertyTypes: ["דירת נופש"],
    title: "דירות נופש",
    singular: "דירת נופש",
    countOne: "דירת נופש אחת",
    description: "דירות נופש פעילות עם פירוט חדרים, מתקנים, תמונות ואפשרויות הזמנה.",
    footerTopic: "vacation-apartments",
  },
];

function contains(property: Property, terms: string[]) {
  const haystack = `${property.area} ${property.location}`;
  return terms.some((term) => haystack.includes(term));
}

export const accommodationRegions: AccommodationRegion[] = [
  { slug: "north", label: "צפון", matches: (property) => contains(property, ["צפון", "גליל", "גולן"]) },
  { slug: "kinneret", label: "כנרת", matches: (property) => contains(property, ["כנרת"]) },
  { slug: "western-galilee", label: "גליל מערבי", matches: (property) => contains(property, ["גליל מערבי"]) },
  { slug: "center", label: "מרכז", matches: (property) => contains(property, ["מרכז", "השרון", "מישור החוף והשפלה"]) },
  { slug: "jerusalem", label: "ירושלים", matches: (property) => contains(property, ["ירושלים"]) },
  { slug: "dead-sea", label: "ים המלח", matches: (property) => contains(property, ["ים המלח"]) },
  { slug: "eilat", label: "אילת", matches: (property) => contains(property, ["אילת", "הערבה"]) },
];

export function getAccommodationCategory(id: AccommodationCategoryId) {
  return accommodationCategories.find((category) => category.id === id);
}

export function getAccommodationRegion(slug?: string | null) {
  return slug ? accommodationRegions.find((region) => region.slug === slug) : undefined;
}

export function accommodationListings(category: AccommodationCategory, region?: AccommodationRegion) {
  return properties.filter((property) => category.propertyTypes.includes(property.type) && (!region || region.matches(property)));
}

export function accommodationLandingPath(category: AccommodationCategory, region?: AccommodationRegion) {
  return `${category.path}${region ? `/${region.slug}` : ""}`;
}

const minimumRegionalListings = 1;

function accommodationRegionForArea(area: string) {
  const normalized = area.trim();
  return accommodationRegions.find((region) => {
    if (region.label === normalized) return true;
    if (region.slug === "north") return normalized.includes("צפון");
    if (region.slug === "kinneret") return normalized.includes("כנרת");
    if (region.slug === "western-galilee") return normalized.includes("גליל מערבי");
    if (region.slug === "center") return normalized.includes("מרכז") || normalized.includes("השרון");
    if (region.slug === "jerusalem") return normalized.includes("ירושלים");
    if (region.slug === "dead-sea") return normalized.includes("ים המלח");
    if (region.slug === "eilat") return normalized.includes("אילת") || normalized.includes("ערבה");
    return false;
  });
}

export function cleanAccommodationPath(type: string, area: string) {
  const category = accommodationCategories.find((item) => item.propertyTypes.includes(type));
  if (!category) return null;
  if (area === "הכל" || area === "כל הארץ") return category.path;
  const region = accommodationRegionForArea(area);
  if (!region) return null;
  return accommodationLandingPath(category, region);
}

export function indexableAccommodationLandings() {
  return accommodationCategories.flatMap((category) => {
    if (!accommodationListings(category).length) return [];
    const regional = accommodationRegions
      .filter((region) => accommodationListings(category, region).length >= minimumRegionalListings)
      .map((region) => ({ category, region, path: accommodationLandingPath(category, region) }));
    return [{ category, region: undefined, path: category.path }, ...regional];
  });
}

export function accommodationLandingForPath(categoryId: AccommodationCategoryId, regionSlug?: string | null) {
  const category = getAccommodationCategory(categoryId);
  if (!category) return null;
  const region = getAccommodationRegion(regionSlug);
  if (regionSlug && !region) return null;
  const listings = accommodationListings(category, region);
  const path = accommodationLandingPath(category, region);
  const title = region ? `${category.title} ב${region.label}` : `${category.title} בישראל`;
  const description = region
    ? `${category.title} ב${region.label} עם תמונות מלאות, פירוט חדרים ומתקנים ואפשרויות הזמנה. מוצגים רק מקומות פעילים.`
    : category.description;
  return { category, region, listings, path, title, description };
}
