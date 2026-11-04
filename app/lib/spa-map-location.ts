import verifiedLocations from "../data/spa-map-locations.json" with { type: "json" };
import { validMapCoordinate } from "./map-marker-layout.ts";

type SpaLocationSource = { id: number; address?: string; city?: string; lat?: number; lng?: number };
const locations: Record<string, { address: string; city: string; lat: number; lng: number }> = verifiedLocations;
const identity = (value?: string) => (value || "").normalize("NFKC").replace(/\s+/g, " ").trim();

export function verifiedSpaMapLocation(site: SpaLocationSource) {
  if (validMapCoordinate(site.lat, site.lng)) return { lat: site.lat!, lng: site.lng!, precision: "exact" as const };
  const source = locations[String(site.id)];
  if (!source || !identity(site.address) || identity(site.address) !== identity(source.address)
    || identity(site.city) !== identity(source.city) || !validMapCoordinate(source.lat, source.lng)) return null;
  return { lat: source.lat, lng: source.lng, precision: "exact" as const };
}
