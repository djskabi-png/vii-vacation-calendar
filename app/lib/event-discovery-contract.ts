export const EVENT_DISCOVERY_VERSION = 3;
export const EVENT_DISCOVERY_MAX_AGE_MS = 60 * 60_000;

// Event landings contain the complete matching set. A shared editorial rail's
// twenty-card cap must not silently become an inventory limit.
export function uniqueEventVenueItems<T>(items: readonly T[], identity: (item: T) => string | number): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = String(identity(item));
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}

/** Keep every event venue and put the commercially useful states first. */
export function orderEventResults<T>(items: readonly T[], read: (item: T) => { available?: boolean | null; price?: number | null; id: string | number }) {
  const tier = (row: ReturnType<typeof read>) => row.available === true && typeof row.price === "number" && row.price > 0 ? 0
    : row.available === true ? 1 : typeof row.price === "number" && row.price > 0 ? 2 : row.available === false ? 3 : 4;
  return [...items].sort((a, b) => tier(read(a)) - tier(read(b)) || String(read(a).id).localeCompare(String(read(b).id), "en", { numeric: true }));
}

export type EventDealPresetId = "lastminute" | "thursday" | "friday";
export function eventDealPagePath(preset: EventDealPresetId) {
  return preset === "lastminute" ? "/events/last-minute" : `/events/${preset}`;
}

export function eventDiscoveryResponseMatches(value: unknown, date: string, guests: number, region?: string, now = Date.now()) {
  if (!value || typeof value !== "object") return false;
  const row = value as { discoveryVersion?: number; scope?: {date:string;guests:number}; region?: string; results?: unknown[]; places?: unknown[]; cache?: {checkedAt?:string} };
  const checked = Date.parse(row.cache?.checkedAt || "");
  return row.discoveryVersion === EVENT_DISCOVERY_VERSION && row.scope?.date === date && row.scope?.guests === guests
    && row.region === region && Array.isArray(row.results) && Array.isArray(row.places)
    && Number.isFinite(checked) && checked <= now + 120_000 && now - checked <= EVENT_DISCOVERY_MAX_AGE_MS;
}
