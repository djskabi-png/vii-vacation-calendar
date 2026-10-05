import verifiedCatalog from "./verified-catalog.json";
import supplierCatalog from "./sergey-public-catalog.json";
import retiredRoutes from "./retired-place-routes.json";

// Only identical source URLs establish identity. Name aliases require supplier approval.
export function supplierLegacySlug(id: string | undefined, world: "vacations" | "events") {
  if (!id) return undefined;
  const legacy = (world === "vacations" ? verifiedCatalog.vacation : verifiedCatalog.events).find((place) => place.id === id);
  if (!legacy) return undefined;
  return supplierCatalog.places.find((place) => place.world === world && place.sourceUrl === legacy.sourceUrl)?.slug;
}

// Retired route labels explain absence; they never establish a supplier identity.
export function unavailableLegacyPlace(id: string | undefined, world: "vacations" | "events") {
  if (!id || supplierLegacySlug(id, world) || supplierCatalog.places.some((place) => place.world === world && place.slug === id)) return undefined;
  const verified = (world === "vacations" ? verifiedCatalog.vacation : verifiedCatalog.events).find((place) => place.id === id);
  const retired = retiredRoutes.find((place) => place.world === world && place.slug === id);
  return verified ? { name: verified.name, area: verified.area } : retired ? { name: retired.name, area: retired.area } : undefined;
}

export function unavailableLegacySearchHref(id: string | undefined, world: "vacations" | "events") {
  const place = unavailableLegacyPlace(id, world);
  if (!place || !id) return undefined;
  const query = new URLSearchParams({ unavailable: id, location: place.area });
  return `${world === "events" ? "/events/search" : "/search"}?${query}`;
}
