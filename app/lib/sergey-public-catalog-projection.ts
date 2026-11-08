import { canonicalSergeyAmenityLabel } from "./sergey-amenities.ts";
import { localGalleryMediaUrl } from "./legacy-gallery-media.ts";
import { withVacationAccommodationTypes } from "./vacation-accommodation-types.ts";
import { withLegacyAmenitySearchProjection, withLegacyEventAmenitySearchProjection } from "./legacy-amenity-search-projection.ts";
import { legacyEventVenueTypes } from "./legacy-event-type-memberships.ts";

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
  const normalizedImages = Array.isArray(source.images)
    ? [...new Set(source.images.map(localGalleryMediaUrl).filter((item): item is string => Boolean(item)))]
    : [];
  const normalizedImage = typeof source.image === "string" ? localGalleryMediaUrl(source.image) : null;
  const projected: Record<string, unknown> = {
    ...source,
    ...(typeof source.image === "string" ? { image: normalizedImage || normalizedImages[0] || null } : {}),
    ...(Array.isArray(source.images) ? { images: normalizedImages } : {}),
    ...(Array.isArray(source.features) ? { features: labels(source.features) } : {}),
    ...(Array.isArray(source.featureGroups) ? { featureGroups: groups(source.featureGroups) } : {}),
  };
  // Refresh bookkeeping belongs to the private accepted snapshot, not a
  // visitor's place or room payload. Preserve every supplier-facing fact.
  delete projected._viiCatalog;
  if (Array.isArray(source.rooms)) projected.rooms = source.rooms.map(projectSergeyPublicCatalogValue);
  if (source.summary && typeof source.summary === "object") projected.summary = projectSergeyPublicCatalogValue(source.summary);
  if (source.detail && typeof source.detail === "object") projected.detail = projectSergeyPublicCatalogValue(source.detail);
  const isVacation = source.world === "vacations" || (typeof source.slug === "string" && /^vacation-\d+$/.test(source.slug));
  const isEvent = source.world === "events" || (typeof source.slug === "string" && /^event-\d+$/.test(source.slug));
  if (isEvent) projected.types = [...new Set([
    ...(Array.isArray(source.types) ? source.types.filter((value): value is string => typeof value === "string") : []),
    ...(typeof source.type === "string" ? [source.type] : []),
    ...legacyEventVenueTypes(source),
  ])];
  return (isVacation ? withLegacyAmenitySearchProjection(withVacationAccommodationTypes(projected)) : withLegacyEventAmenitySearchProjection(projected)) as T;
}
