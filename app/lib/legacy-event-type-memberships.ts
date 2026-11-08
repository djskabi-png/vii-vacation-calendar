import snapshot from "../data/legacy-event-search-memberships.json" with { type: "json" };

type SourceIdentity = { slug?: string; supplierId?: unknown };
function idOf(place: SourceIdentity) {
  const id = Number(place.supplierId || /^event-(\d+)$/.exec(place.slug || "")?.[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}
const lofts = new Set(snapshot.pages.filter(page => page.venueType === "לופטים").flatMap(page => page.ids));
const regions = new Map<string, Set<number>>();
for (const page of snapshot.pages) {
  const ids = regions.get(page.area) || new Set<number>();
  page.ids.forEach(id => ids.add(id));
  regions.set(page.area, ids);
}

// Positive source memberships supplement current supplier facts. These never
// create inventory: consumers still start from the active published catalog.
export function legacyEventVenueTypes(place: SourceIdentity): string[] {
  return lofts.has(idOf(place)) ? ["לופטים"] : [];
}

export function matchesLegacyEventArea(place: SourceIdentity, area: string) {
  const region = area === "דרום ונגב" ? "דרום" : area;
  return regions.get(region)?.has(idOf(place)) || false;
}
