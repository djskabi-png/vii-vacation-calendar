import type { PublicGeographyNode } from "./geography-search.ts";

export const nearbySearchCenters = [
  { label: "צפון", lat: 32.96, lng: 35.5 },
  { label: "מרכז", lat: 32.08, lng: 34.8 },
  { label: "ירושלים והרי יהודה", lat: 31.78, lng: 35.21 },
  { label: "דרום", lat: 31.25, lng: 34.79 },
  { label: "אילת והערבה", lat: 29.56, lng: 34.95 },
] as const;

export type NearbySearchLocation = (typeof nearbySearchCenters)[number]["label"];
export type NearbySearchResolution = { location: string; precision: "city" | "region"; distanceKm: number };

const MAX_CITY_DISTANCE_KM = 60;
const MAX_REGION_DISTANCE_KM = 180;

function radians(value: number) {
  return value * Math.PI / 180;
}

function distanceKm(latitude: number, longitude: number, targetLatitude: number, targetLongitude: number) {
  const origin = radians(latitude);
  const target = radians(targetLatitude);
  const latitudeDelta = target - origin;
  const longitudeDelta = radians(targetLongitude - longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(origin) * Math.cos(target) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function nearestSearchResolution(latitude: number, longitude: number, nodes: readonly PublicGeographyNode[] = []): NearbySearchResolution | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const nearestCity = nodes
    .filter((node) => node.level === "city" && !node.unassigned && node.title.trim()
      && node.gpsLat !== null && node.gpsLong !== null && Number.isFinite(node.gpsLat) && Number.isFinite(node.gpsLong))
    .map((node) => ({ location: node.title.trim(), distanceKm: distanceKm(latitude, longitude, node.gpsLat as number, node.gpsLong as number) }))
    .sort((left, right) => left.distanceKm - right.distanceKm || left.location.localeCompare(right.location, "he"))[0];
  if (nearestCity && nearestCity.distanceKm <= MAX_CITY_DISTANCE_KM) return { ...nearestCity, precision: "city" };
  const nearestRegion = nearbySearchCenters
    .map((item) => ({ location: item.label, distanceKm: distanceKm(latitude, longitude, item.lat, item.lng) }))
    .sort((left, right) => left.distanceKm - right.distanceKm)[0];
  return nearestRegion && nearestRegion.distanceKm <= MAX_REGION_DISTANCE_KM ? { ...nearestRegion, precision: "region" } : null;
}

export function nearestSearchLocation(latitude: number, longitude: number, nodes: readonly PublicGeographyNode[] = []): string | null {
  return nearestSearchResolution(latitude, longitude, nodes)?.location ?? null;
}

export function cloudflareRequestCoordinates(request: Request) {
  const cf = (request as Request & { cf?: { latitude?: unknown; longitude?: unknown } }).cf;
  const latitude = Number(cf?.latitude);
  const longitude = Number(cf?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}
