import catalog from "../data/sergey-public-catalog.json" with { type: "json" };
import accepted from "../data/accepted-runtime-catalog-state.json" with { type: "json" };
import { publicCatalogEntryAllowed } from "./public-catalog-policy.ts";
import { projectSergeyPublicCatalogValue } from "./sergey-public-catalog-projection.ts";

type World = "vacations" | "events";
function acceptedEntries(world: World) {
  const state = accepted.worlds[world];
  const ids = new Set<number>(state.ids);
  const entries = new Map<number, unknown>();
  for (const place of [...catalog.places, ...state.additions]) {
    if (place.world === world && ids.has(place.supplierId) && publicCatalogEntryAllowed(place)) entries.set(place.supplierId, projectSergeyPublicCatalogValue(place));
  }
  return entries;
}
const summaries = { vacations: acceptedEntries("vacations"), events: acceptedEntries("events") };
/** One accepted-build authority for resilient public fallback. Not a live generation replacement. */
export function acceptedSergeySummaries(world: World) {
  return [...summaries[world].values()];
}
export async function acceptedSergeyDetail<T>(world: World, supplierId: number): Promise<T | null> {
  if (!summaries[world].has(supplierId)) return null;
  const { default: details } = await import("./accepted-detail-source.ts");
  const slug = `${world === "vacations" ? "vacation" : "event"}-${supplierId}`;
  const detail = (details.details as unknown as Record<string, T>)[slug];
  return detail ? projectSergeyPublicCatalogValue(detail) : null;
}
