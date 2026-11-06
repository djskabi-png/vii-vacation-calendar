export type MapCoordinatePrecision = "exact" | "area";

/** Legacy listings default to exact to preserve the existing source-point contract. */
export function listingMapPrecision(value: unknown): MapCoordinatePrecision {
  return value === "area" ? "area" : "exact";
}

/** Discovery records are area-level unless the producer explicitly proves an exact point. */
export function discoveryMapPrecision(value: unknown): MapCoordinatePrecision {
  return value === "exact" ? "exact" : "area";
}
