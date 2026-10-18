import { canonicalSearchLocation, geographicAnchorSelection, normalizeGeographicName } from "./geographic-names.ts";
export type PublicGeographyNode = {
  key: string;
  level: "district" | "area" | "city";
  parentKey: string | null;
  title: string;
  titleEn: string;
  slug: string;
  featured: boolean;
  gpsLat: number | null;
  gpsLong: number | null;
  unassigned: boolean;
};

export type CoordinatePlace = {
  location?: string;
  area?: string;
  lat?: number;
  lng?: number;
};

export type NearbyPlace<T> = { place: T; distanceKm: number };

function normalized(value?: string | null) {
  return normalizeGeographicName(canonicalSearchLocation(value));
}

export function geographyNodeForSelection(nodes: readonly PublicGeographyNode[], selection?: string | null) {
  const target = normalized(selection);
  if (!target) return null;
  return nodes.find(node => node.key === selection)
    || nodes.find((node) => normalized(node.title) === target || normalized(node.titleEn) === target || (node.slug && normalized(node.slug) === target)) || null;
}

export function distanceKm(first: { lat: number; lng: number }, second: { lat: number; lng: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(second.lat - first.lat);
  const longitudeDelta = radians(second.lng - first.lng);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearbyPlacesForSelection<T extends CoordinatePlace>(
  places: readonly T[],
  nodes: readonly PublicGeographyNode[],
  selection: string,
  options: { limit?: number; maximumDistanceKm?: number; minimumResults?: number } = {},
): NearbyPlace<T>[] {
  const target = geographyNodeForSelection(nodes, selection);
  if (!target) return [];
  const descendantKeys = new Set([target.key]);
  for (let pass = 0; pass < nodes.length; pass++) {
    const before = descendantKeys.size;
    for (const node of nodes) if (node.parentKey && descendantKeys.has(node.parentKey)) descendantKeys.add(node.key);
    if (before === descendantKeys.size) break;
  }
  const childPoints = nodes.filter((node) => descendantKeys.has(node.key) && node.level === "city"
    && Number.isFinite(node.gpsLat) && Number.isFinite(node.gpsLong));
  const anchor = geographicAnchorSelection(selection);
  const anchorNode = anchor ? nodes.find(node => node.level === "city" && normalized(node.title) === normalized(anchor)
    && node.gpsLat !== null && node.gpsLong !== null && Number.isFinite(node.gpsLat) && Number.isFinite(node.gpsLong)) : null;
  const origin = target.gpsLat !== null && target.gpsLong !== null && Number.isFinite(target.gpsLat) && Number.isFinite(target.gpsLong)
    ? { lat: target.gpsLat!, lng: target.gpsLong! }
    : childPoints.length ? {
      lat: childPoints.reduce((sum, node) => sum + node.gpsLat!, 0) / childPoints.length,
      lng: childPoints.reduce((sum, node) => sum + node.gpsLong!, 0) / childPoints.length,
    } : anchorNode ? { lat: anchorNode.gpsLat!, lng: anchorNode.gpsLong! } : null;
  if (!origin) return [];
  const maximumDistanceKm = options.maximumDistanceKm ?? 100;
  const limit = options.limit ?? 12;
  const minimumResults = Math.max(0, options.minimumResults ?? 0);
  const coordinatesByLocation = new Map(nodes
    .filter((node) => node.level === "city" && node.gpsLat !== null && node.gpsLong !== null)
    .flatMap((node) => [node.title, node.titleEn, node.slug]
      .map(normalized)
      .filter(Boolean)
      .map((name) => [name, { lat: node.gpsLat as number, lng: node.gpsLong as number }] as const)));
  const seen = new Set<unknown>();
  const ranked = places.filter((place) => {
      const identity = (place as { id?: unknown; slug?: string }).id || (place as { slug?: string }).slug || place;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .map((place) => {
      const coordinates = Number.isFinite(place.lat) && Number.isFinite(place.lng)
        ? { lat: place.lat as number, lng: place.lng as number }
        : coordinatesByLocation.get(normalized(place.location));
      return coordinates ? { place, distanceKm: distanceKm(origin, coordinates) } : null;
    })
    .filter((candidate): candidate is NearbyPlace<T> => candidate !== null)
    .sort((left, right) => left.distanceKm - right.distanceKm
      || normalized(left.place.location).localeCompare(normalized(right.place.location), "he"))
  const bounded = ranked.filter((candidate) => candidate.distanceKm <= maximumDistanceKm);
  // Keep the normal radius when it already satisfies the requested minimum.
  // If it does not, expand geographically to the closest real candidates. We
  // never relax the caller's hard filters because this helper only receives
  // the already-filtered inventory.
  return (bounded.length >= minimumResults ? bounded : ranked).slice(0, limit);
}
