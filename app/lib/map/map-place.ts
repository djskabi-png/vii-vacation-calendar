import type { EventPlace, Listing } from "../../data/site-data";
import type { DiscoveryItem } from "../../data/world-data";
import type { Trail } from "../../data/trail-data";
import { eventPlaceHref } from "../event-place-href.ts";
import { formatMapPrice, priceModeFromLabel, validMapPrice, verifiedPriceFromLabel, type MapPriceQuote } from "../map-price.ts";
import { validMapCoordinate } from "../map-marker-layout.ts";
import { latinBusinessAlias, localizedBusinessText } from "../../i18n/localized-business-content.ts";
import { discoveryMapPrecision, listingMapPrecision } from "./coordinate-precision.ts";

export type MapTone = "vacation" | "events" | "spa" | "hourly" | "activities";
export { discoveryMapPrecision, listingMapPrecision } from "./coordinate-precision.ts";
export type MapPlace = {
  id: string; name: string; location: string; area: string; category: string; meta: string; image: string;
  lat: number; lng: number; href: string; markerLabel: string;
  markerKind: "price" | "capacity" | "count" | "category"; valueLabel?: string;
  rating?: number; reviews?: number; precision?: "exact" | "area"; illustrativeImage?: boolean; representedCount?: number;
};
type Copy = { place: string; location: string; area: string };
type Translator = (value: string) => string;

export function listingMapPlaces(listings: Listing[], language: "he" | "en" | "ru" | "fr", translate: Translator, fallback: Copy, mode: "vacation" | "events", detailQuery: string | undefined, priceById: Record<string, MapPriceQuote> | undefined, units: { bedrooms: string; units: string; guests: string; upTo: string }): MapPlace[] {
  return listings.filter((listing) => validMapCoordinate(listing.lat, listing.lng)).map((listing) => {
    const verifiedPrice = priceById?.[listing.slug] ?? (validMapPrice(listing.price) ? { amount: listing.price, mode: "from" as const } : undefined);
    const compactPrice = verifiedPrice ? formatMapPrice(verifiedPrice, language) : "";
    const fullPrice = verifiedPrice ? formatMapPrice(verifiedPrice, language, false) : "";
    return { id: listing.slug, name: localizedBusinessText(listing.name, language, translate, latinBusinessAlias(listing.name) || fallback.place), location: localizedBusinessText(listing.location, language, translate, latinBusinessAlias(listing.location) || fallback.location), area: localizedBusinessText(listing.area, language, translate, latinBusinessAlias(listing.area) || fallback.area), category: translate(listing.type), meta: [listing.bedrooms ? `${listing.bedrooms} ${units.bedrooms}` : null, listing.units && listing.units > 1 ? `${listing.units} ${units.units}` : null, listing.guests > 0 ? `${units.upTo} ${listing.guests} ${units.guests}` : null].filter(Boolean).join(" · "), image: listing.image, lat: listing.lat!, lng: listing.lng!, href: mode === "events" ? eventPlaceHref(listing as EventPlace) : `/business?id=${listing.slug}${detailQuery ? `&${detailQuery}` : ""}`, markerLabel: compactPrice || (mode === "events" && listing.guests > 0 ? `${listing.guests} ${units.guests}` : translate(listing.type)), markerKind: compactPrice ? "price" : mode === "events" && listing.guests > 0 ? "capacity" : "category", valueLabel: fullPrice || undefined, rating: listing.score, reviews: listing.reviews, precision: listingMapPrecision(listing.mapPrecision) };
  });
}

export function discoveryMapPlaces(items: DiscoveryItem[], language: "he" | "en" | "ru" | "fr", translate: Translator, fallback: Copy, tone: Exclude<MapTone, "vacation" | "events">, localized: { spa: string; hourly: string; packages: string; short: string; from: string } | null): MapPlace[] {
  return items.filter((item) => validMapCoordinate(item.lat, item.lng)).map((item) => {
    const price = verifiedPriceFromLabel(item.priceLabel);
    const priceQuote = price ? { amount: price, mode: priceModeFromLabel(item.priceLabel) } satisfies MapPriceQuote : null;
    const compactPrice = priceQuote ? formatMapPrice(priceQuote, language) : "";
    const fullPrice = priceQuote ? formatMapPrice(priceQuote, language, false) : "";
    return { id: item.id, name: localizedBusinessText(item.name, language, translate, latinBusinessAlias(item.name) || fallback.place), location: localizedBusinessText(item.location, language, translate, latinBusinessAlias(item.location) || fallback.location), area: localizedBusinessText(item.area, language, translate, latinBusinessAlias(item.area) || fallback.area), category: tone === "activities" ? localizedBusinessText(item.area, language, translate, latinBusinessAlias(item.area) || fallback.area) : localized ? (tone === "spa" ? localized.spa : localized.hourly) : tone === "spa" ? "ספא וטיפולים" : "שהייה לפי שעה", meta: localized ? (price ? fullPrice : tone === "spa" ? localized.packages : tone === "activities" ? localizedBusinessText(item.priceLabel || item.location, language, translate, fallback.location) : localized.short) : item.priceLabel || (tone === "spa" ? "חבילות וטיפולים" : tone === "activities" ? "חוויה בתשלום" : "שהייה קצרה"), image: item.image || "/vii-logo.png", lat: item.lat!, lng: item.lng!, href: `/discover/place/${item.id}`, markerLabel: compactPrice || (tone === "spa" ? "ספא" : tone === "activities" ? "אטרקציה" : "לפי שעה"), markerKind: compactPrice ? "price" : "category", valueLabel: fullPrice || undefined, rating: item.rating, precision: discoveryMapPrecision(item.mapPrecision) };
  });
}

export const trailAreaCenters: Record<Trail["mainArea"], { lat: number; lng: number }> = { "צפון": { lat: 33.02, lng: 35.38 }, "כנרת": { lat: 32.79, lng: 35.54 }, "חיפה": { lat: 32.79, lng: 35.02 }, "מרכז": { lat: 32.12, lng: 34.93 }, "תל אביב": { lat: 32.08, lng: 34.78 }, "דרום ונגב": { lat: 30.82, lng: 34.79 }, "ירושלים": { lat: 31.78, lng: 35.17 }, "אילת והסביבה": { lat: 29.56, lng: 34.95 } };
