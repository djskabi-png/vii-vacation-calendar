import type { DiscoveryItem } from "../data/world-data.ts";
import type { SpaPlusSite } from "../data/spaplus.ts";
import { spaPlusAudience } from "../data/spa-audience.ts";
import { spaPlusArea } from "../data/spa-regions.ts";
import { spaViiCopyOrNull } from "../data/spa-vii-copy.ts";
import { spaSourceServiceTerms } from "../data/spa-landings.ts";
import { verifiedSpaMapLocation } from "./spa-map-location.ts";

const spaAreaCoordinates: Record<string, { lat: number; lng: number }> = {
  "נהריה": { lat: 33.006, lng: 35.095 },
  "חיפה": { lat: 32.794, lng: 34.989 },
  "רגבה": { lat: 32.977, lng: 35.099 },
  "כמון": { lat: 32.913, lng: 35.36 },
  "תל אביב": { lat: 32.085, lng: 34.781 },
  // Accepted VII geography city center, checked 2026-11-04. This is never an exact business pin.
  "רחובות": { lat: 31.892773, lng: 34.811272 },
  "הרצליה": { lat: 32.166, lng: 34.843 },
  "ירושלים": { lat: 31.778, lng: 35.223 },
  "רמת גן": { lat: 32.082, lng: 34.814 },
  "אילת": { lat: 29.558, lng: 34.948 },
  "אשדוד": { lat: 31.8, lng: 34.65 },
  "נווה אילן": { lat: 31.808, lng: 35.081 },
  "מעלה החמישה": { lat: 31.817, lng: 35.11 },
  "טבריה": { lat: 32.794, lng: 35.532 },
};

export const spaPlacesFromSites = (sites: SpaPlusSite[]): DiscoveryItem[] => sites.map((site) => {
  const audiences = [...new Set(site.packages.map(spaPlusAudience).filter((value) => value !== "לא צוין"))];
  const prices = site.packages.map((pack) => pack.price);
  const verifiedCoordinates = verifiedSpaMapLocation(site);
  const coordinates = verifiedCoordinates || spaAreaCoordinates[site.city];
  const approvedCopy = spaViiCopyOrNull(site.id);
  const factualFeatures = Array.isArray(site.features) ? site.features.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];
  return {
    id: `spa-${site.id}`,
    world: "spa",
    name: site.title,
    location: site.city || "מיקום לא נמסר",
    area: spaPlusArea(site.city),
    description: site.shortDescription || approvedCopy?.cardSummary || `${site.title}, מתחם ספא ב${site.city || "ישראל"}.`,
    filterText: approvedCopy?.filterText || [site.title, site.city, ...site.packages.map((pack) => pack.title)].filter(Boolean).join(" "),
    features: [...new Set([...audiences.map((audience) => `חבילות ${audience === "זוג" ? "זוגיות" : audience === "יחיד" ? "ליחיד" : audience === "קבוצה" ? "לקבוצות" : "יום כיף"}`), ...factualFeatures])],
    searchTerms: [...site.packages.map((pack) => pack.title), ...factualFeatures, ...spaSourceServiceTerms(site)],
    image: site.image || undefined,
    images: [...new Set([
      site.image,
      ...(site.gallery || []),
      ...site.packages.map((pack) => pack.image),
    ].filter((image): image is string => Boolean(image)))],
    priceLabel: prices.length ? `החל מ־₪ ${Math.min(...prices).toLocaleString("he-IL")}` : undefined,
    phone: site.phone || undefined,
    sourceUrl: site.bookingUrl || undefined,
    sourceName: "ספא פלוס",
    lat: coordinates?.lat,
    lng: coordinates?.lng,
    mapPrecision: verifiedCoordinates ? "exact" : coordinates ? "area" : undefined,
    indexable: true,
  };
});
