import verifiedCatalog from "./verified-catalog.json";
import supplierCatalog from "./sergey-public-catalog.json";

// Only identical source URLs establish identity. Name aliases require supplier approval.
export function supplierLegacySlug(id: string | undefined, world: "vacations" | "events") {
  if (!id) return undefined;
  const legacy = (world === "vacations" ? verifiedCatalog.vacation : verifiedCatalog.events).find((place) => place.id === id);
  if (!legacy) return undefined;
  return supplierCatalog.places.find((place) => place.world === world && place.sourceUrl === legacy.sourceUrl)?.slug;
}
