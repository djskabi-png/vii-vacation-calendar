export type ProximityPoint = { lat: number; lng: number };
export type LocatedResult = { lat?: number | null; lng?: number | null };

export function validProximityPoint(value: unknown): value is ProximityPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as ProximityPoint;
  return typeof point.lat === "number" && typeof point.lng === "number"
    && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

/** Straight-line distance using actual available points, never an invented area center. */
export function proximityDistance(origin: ProximityPoint | null, item: unknown): number | undefined {
  if (!validProximityPoint(origin) || !validProximityPoint(item)) return undefined;
  const rad = Math.PI / 180;
  const a = Math.sin((item.lat - origin.lat) * rad / 2) ** 2
    + Math.cos(origin.lat * rad) * Math.cos(item.lat * rad) * Math.sin((item.lng - origin.lng) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function orderByProximity<T>(items: readonly T[], distance: (item: T) => number | undefined): T[] {
  // Decorate once: large result sets do not recompute trigonometry on every comparison.
  return items.map((item, index) => ({ item, index, distance: distance(item) }))
    .sort((a, b) => {
      const first = typeof a.distance === "number" && Number.isFinite(a.distance);
      const second = typeof b.distance === "number" && Number.isFinite(b.distance);
      return first && second ? a.distance! - b.distance! || a.index - b.index : first ? -1 : second ? 1 : a.index - b.index;
    }).map(({ item }) => item);
}
