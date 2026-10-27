/** Discovery capability only. Never a price, availability quote or booking authorization. */
const DAY_MS = 86_400_000;
export const CAPABILITY_FRESH_MS = 30 * 60_000;
export const CAPABILITY_MAX_AGE_MS = 30 * DAY_MS;
export type OnlineCapabilityMap = Record<string, { checkedAt: number }>;

type ExplicitCapabilitySearch = { results?: unknown };

/** Convert only explicit supplier capability flags from a live, dated search.
 * Availability and price never imply that a place accepts online bookings. */
export function onlineCapabilitiesFromSearch(value: ExplicitCapabilitySearch, now = Date.now()): OnlineCapabilityMap {
  if (!Array.isArray(value?.results) || !value.results.length) throw new Error("capabilities_unavailable");
  const result: OnlineCapabilityMap = {};
  let explicitFlags = 0;
  for (const item of value.results) {
    const row = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
    if (!Number.isSafeInteger(row.siteID) || Number(row.siteID) < 1 || typeof row.onlineBooking !== "boolean") continue;
    explicitFlags++;
    if (row.onlineBooking === true) result[`vacation-${Number(row.siteID)}`] = { checkedAt: now };
  }
  if (!explicitFlags || !Object.keys(result).length) throw new Error("capabilities_unavailable");
  return result;
}

export function validOnlineCapabilities(value: unknown): value is OnlineCapabilityMap {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length <= 10_000 && Object.entries(value).every(([slug, row]) =>
      /^vacation-[1-9]\d*$/.test(slug) && row && typeof row === "object" && !Array.isArray(row)
      && Object.keys(row).length === 1 && Number.isSafeInteger(row.checkedAt) && row.checkedAt > 0));
}

export function hasOnlineCapability(value: { checkedAt: number } | undefined, now = Date.now()) {
  return Boolean(value && Number.isSafeInteger(value.checkedAt) && value.checkedAt <= now && now - value.checkedAt < CAPABILITY_MAX_AGE_MS);
}

export function publicOnlineCapabilities(value: OnlineCapabilityMap, ids: ReadonlySet<number>, now = Date.now()): OnlineCapabilityMap {
  return Object.fromEntries(Object.entries(value).filter(([slug, row]) => ids.has(Number(slug.slice(9))) && hasOnlineCapability(row, now)));
}

export function capabilityProbe(now: number) {
  // This is capability discovery, not a stay offer. A near one-night probe
  // keeps the supplier query bounded while the returned onlineBooking flag
  // remains independent of whether that particular night is available.
  const from = new Date(now + 2 * DAY_MS).toISOString().slice(0, 10);
  return { from, nights: 1, rooms: [{ adults: 2 }] };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function capabilityCandidateIds(payload: unknown): number[] {
  const places = record(payload).places;
  if (!Array.isArray(places) || !places.length || places.length > 10_000) throw new Error("capabilities_unavailable");
  const seen = new Set<number>();
  const candidates: number[] = [];
  for (const value of places) {
    const row = record(value);
    if (!Number.isSafeInteger(row.siteID) || Number(row.siteID) < 1 || seen.has(Number(row.siteID))) throw new Error("invalid_capabilities");
    seen.add(Number(row.siteID));
    if (row.active === true && row.has_availability === true) candidates.push(Number(row.siteID));
  }
  if (!candidates.length) throw new Error("capabilities_unavailable");
  return candidates;
}

export function mergeCapabilityProbe(payload: unknown, previous: OnlineCapabilityMap = {}, now = Date.now()): OnlineCapabilityMap {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || (payload as { error?: unknown }).error) throw new Error("invalid_capabilities");
  const sites = (payload as { sites?: unknown } | null)?.sites;
  if (!Array.isArray(sites) || sites.length === 0 || sites.length > 10_000) throw new Error("capabilities_unavailable");
  const result = Object.fromEntries(Object.entries(previous).filter(([, row]) => hasOnlineCapability(row, now)));
  const seen = new Set<number>();
  let flags = 0;
  for (const row of sites) {
    if (!row || typeof row !== "object" || !Number.isSafeInteger(row.siteID) || row.siteID < 1 || seen.has(row.siteID)) throw new Error("invalid_capabilities");
    seen.add(row.siteID);
    if (typeof row.onlineBooking !== "boolean") continue;
    flags++;
    const slug = `vacation-${row.siteID}`;
    if (row.onlineBooking === true) result[slug] = { checkedAt: now };
    // The supplier flag is independent of date availability. An explicit false
    // revokes capability even on a busy date; missing/unknown fields do not.
    else delete result[slug];
  }
  if (!flags) throw new Error("invalid_capabilities");
  return result;
}

export async function fetchCapabilityProbe(token: string, previous?: OnlineCapabilityMap, now = Date.now(), fetchImpl: typeof fetch = fetch): Promise<OnlineCapabilityMap> {
  if (!token) throw new Error("capabilities_unavailable");
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const listing = await fetchImpl("https://bizonline.co.il/api/ai/vii/vacations", {
    headers, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!listing.ok) throw new Error("capabilities_unavailable");
  const candidateIds = capabilityCandidateIds(await listing.json().catch(() => null));
  const candidateSlugs = new Set(candidateIds.map(id => `vacation-${id}`));
  let result = Object.fromEntries(Object.entries(previous || {}).filter(([slug, row]) => candidateSlugs.has(slug) && hasOnlineCapability(row, now)));
  let successfulBatches = 0;
  // The provider documents remote_limit as a signal to search fewer sites. Small
  // explicit batches make the capability inventory complete without turning a
  // visitor request into a live supplier scan.
  for (let offset = 0; offset < candidateIds.length; offset += 20) {
    const siteIDs = candidateIds.slice(offset, offset + 20);
    try {
      const response = await fetchImpl("https://bizonline.co.il/api/ai/vii/vacations/search", {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ...capabilityProbe(now), siteIDs }), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) continue;
      const payload = await response.json().catch(() => null);
      const sites = record(payload).sites;
      if (!Array.isArray(sites) || sites.some(value => !siteIDs.includes(Number(record(value).siteID)))) continue;
      result = mergeCapabilityProbe(payload, result, now);
      successfulBatches++;
    } catch { /* Keep the last-good rows for this batch; the next refresh will retry. */ }
  }
  if (!successfulBatches) throw new Error("capabilities_unavailable");
  return result;
}
