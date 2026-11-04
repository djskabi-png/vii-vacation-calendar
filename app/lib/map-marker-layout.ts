import { distanceKm } from "./geography-search.ts";

export function validMapCoordinate(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && (lat !== 0 || lng !== 0);
}

/** A close zoom must reveal distinct source points, not manufacture a ring around a cluster. */
export function spreadMapCluster(points: readonly { lat: number; lng: number }[], zoom: number, maxZoom = 19) {
  return points.length > 1 && (zoom >= maxZoom || points.every(point => distanceKm(points[0], point) <= 0.003));
}

/** Stable ordering prevents the same coincident cluster moving between unrelated rings. */
export function mapSpiderOffset(index: number, count: number) {
  const angle = -Math.PI / 2 + index * Math.PI * (3 - Math.sqrt(5));
  const radius = count <= 3 ? 44 + index * 14 : 34 + Math.sqrt(index + 1) * 24;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
