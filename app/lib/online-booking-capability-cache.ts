import type { D1Database } from "../../types/cloudflare-runtime";
import { cachedDiscovery, readCachedDiscovery } from "./discovery-offer-cache.ts";
import { CAPABILITY_FRESH_MS, CAPABILITY_MAX_AGE_MS, fetchCapabilityProbe, validOnlineCapabilities, type OnlineCapabilityMap } from "./online-booking-capability.ts";
import { supplierToken } from "./vii-supplier-token.ts";

type ObservedCapabilityRow = { payload: string | null; checked_at: number };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Recover booking evidence already accepted in dated vacation snapshots. */
export function observedOnlineCapabilities(rows: readonly ObservedCapabilityRow[], now = Date.now()): OnlineCapabilityMap {
  const result: OnlineCapabilityMap = {};
  for (const row of rows) {
    if (!row.payload || !Number.isSafeInteger(row.checked_at) || row.checked_at <= 0
      || row.checked_at > now || now - row.checked_at >= CAPABILITY_MAX_AGE_MS) continue;
    let value: Record<string, unknown>;
    try { value = record(JSON.parse(row.payload)); } catch { continue; }
    // Both near-date rails (`deals`) and dated discovery (`results`) contain
    // supplier-confirmed responses. The booking flag is copied verbatim from
    // those accepted provider payloads; no capability is inferred from price
    // or availability alone.
    const candidates = [
      ...(Array.isArray(value.deals) ? value.deals : []),
      ...(Array.isArray(value.results) ? value.results : []),
    ];
    for (const candidate of candidates) {
      const deal = record(candidate);
      if (deal.onlineBooking !== true || !Number.isSafeInteger(deal.siteID) || Number(deal.siteID) < 1) continue;
      const slug = `vacation-${Number(deal.siteID)}`;
      if (row.checked_at > (result[slug]?.checkedAt ?? 0)) result[slug] = { checkedAt: row.checked_at };
    }
  }
  return result;
}

export async function readObservedOnlineCapabilities(db: D1Database | null, now = Date.now()) {
  if (!db) return {};
  // Project only the positive capability facts in SQL. The raw discovery body
  // can be very large; returning 128 of those bodies can exceed a Worker heap.
  const rows = await db.prepare(`WITH recent AS (
      SELECT payload, checked_at FROM vii_discovery_offer_cache_v1
      WHERE payload IS NOT NULL AND payload LIKE '%"onlineBooking":true%'
        AND checked_at >= ? ORDER BY checked_at DESC LIMIT 128
    ), arrays AS (
      SELECT payload, checked_at, '$.deals' AS path FROM recent
      UNION ALL SELECT payload, checked_at, '$.results' AS path FROM recent
    ), items AS (
      SELECT arrays.checked_at, CASE WHEN item.type = 'object' THEN item.value ELSE '{}' END AS value
      FROM arrays, json_each(CASE WHEN json_valid(arrays.payload) THEN arrays.payload ELSE '{}' END, arrays.path) item
      WHERE json_type(CASE WHEN json_valid(arrays.payload) THEN arrays.payload ELSE '{}' END, arrays.path) = 'array'
    )
    SELECT json_extract(value, '$.siteID') AS siteID, MAX(checked_at) AS checkedAt FROM items
    WHERE json_type(value, '$.siteID') IN ('integer', 'real')
      AND json_extract(value, '$.siteID') = CAST(json_extract(value, '$.siteID') AS INTEGER)
      AND json_extract(value, '$.siteID') BETWEEN 1 AND 9007199254740991
      AND json_type(value, '$.onlineBooking') = 'true'
      AND typeof(checked_at) = 'integer' AND checked_at > 0 AND checked_at <= ? AND checked_at > ?
    GROUP BY json_extract(value, '$.siteID')`).bind(now - CAPABILITY_MAX_AGE_MS,now,now-CAPABILITY_MAX_AGE_MS)
    .all<{siteID:number;checkedAt:number}>();
  const result:OnlineCapabilityMap={};
  for(const row of rows.results)if(Number.isSafeInteger(row.siteID)&&row.siteID>0&&Number.isSafeInteger(row.checkedAt)
    &&row.checkedAt>0&&row.checkedAt<=now&&now-row.checkedAt<CAPABILITY_MAX_AGE_MS)result[`vacation-${row.siteID}`]={checkedAt:row.checkedAt};
  return result;
}

export function cachedOnlineCapabilities(db: D1Database | null) {
  return cachedDiscovery<OnlineCapabilityMap>({
    key: ["vacation-online-capability", 1], db,
    policy: { freshMs: CAPABILITY_FRESH_MS, staleMs: CAPABILITY_MAX_AGE_MS },
    load: async previous => fetchCapabilityProbe(await supplierToken(), previous),
    validate: validOnlineCapabilities,
  });
}

/** Public discovery reads are deliberately provider-free. */
export function readCachedOnlineCapabilities(db: D1Database | null) {
  return (async () => {
    const observed = await readObservedOnlineCapabilities(db).catch(() => ({}));
    try {
      const dedicated = await readCachedDiscovery<OnlineCapabilityMap>({
        key: ["vacation-online-capability", 1], db,
        policy: { freshMs: CAPABILITY_FRESH_MS, staleMs: CAPABILITY_MAX_AGE_MS },
        validate: validOnlineCapabilities,
      });
      return { ...dedicated, value: { ...observed, ...dedicated.value } };
    } catch {
      if (!validOnlineCapabilities(observed) || !Object.keys(observed).length) throw new Error("discovery_unavailable");
      const checkedAt = Math.max(...Object.values(observed).map(row => row.checkedAt));
      return { value: observed, cache: { status: "stale" as const, checkedAt: new Date(checkedAt).toISOString() } };
    }
  })();
}
