import { canonicalSergeyAmenityLabel } from "./sergey-amenities.ts";

function labels(value: unknown) {
  return Array.isArray(value) ? value.map(canonicalSergeyAmenityLabel).filter(Boolean) : value;
}

function groups(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value.map((group) => {
    if (!group || typeof group !== "object" || Array.isArray(group)) return group;
    return { ...group, items: labels((group as Record<string, unknown>).items) };
  });
}

/**
 * Applies supplier terminology corrections at the public read boundary.
 * This keeps the immutable accepted fallback and already accepted runtime rows
 * aligned with newly normalized API pulls without mutating supplier data.
 */
export function projectSergeyPublicCatalogValue<T>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const source = value as Record<string, unknown>;
  const projected: Record<string, unknown> = {
    ...source,
    ...(Array.isArray(source.features) ? { features: labels(source.features) } : {}),
    ...(Array.isArray(source.featureGroups) ? { featureGroups: groups(source.featureGroups) } : {}),
  };
  if (Array.isArray(source.rooms)) projected.rooms = source.rooms.map(projectSergeyPublicCatalogValue);
  if (source.summary && typeof source.summary === "object") projected.summary = projectSergeyPublicCatalogValue(source.summary);
  if (source.detail && typeof source.detail === "object") projected.detail = projectSergeyPublicCatalogValue(source.detail);
  return projected as T;
}
