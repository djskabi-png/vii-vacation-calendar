import type { D1Database } from "../../types/cloudflare-runtime";
import { readSupplierCatalogState } from "./supplier-catalog-store.ts";

/** Catalog advertising prices are not a quote or evidence of availability. */
export type SeasonalStartingPrices = { startPriceWinter?: number; startPriceSummer?: number };
export type StartingPriceWorld = "vacations" | "events";
export type StartingPriceMap = Record<string, SeasonalStartingPrices>;

function positive(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

export function startingPriceFields(value: unknown): SeasonalStartingPrices {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    ...(positive(row.startPriceWinter) ? { startPriceWinter: row.startPriceWinter } : {}),
    ...(positive(row.startPriceSummer) ? { startPriceSummer: row.startPriceSummer } : {}),
  };
}

export function supplierStartingPrice(value: unknown): number | null {
  const prices = Object.values(startingPriceFields(value));
  return prices.length ? Math.min(...prices) : null;
}

export function hasSearchDate(params: Pick<URLSearchParams, "get">): boolean {
  // Half-filled/invalid/flexible date selections must never look like undated browsing.
  return params.get("dateMode") === "flexible" || ["from", "till", "to", "dates", "date"].some(key => Boolean(params.get(key)?.trim()));
}

export function startingPriceCatalog(world: StartingPriceWorld, value: unknown): StartingPriceMap {
  const body = value as { places?: unknown; error?: unknown } | null;
  if (!body || body.error || !Array.isArray(body.places) || !body.places.length || body.places.length > 10_000) throw new Error("starting_prices_unavailable");
  const result: StartingPriceMap = {};
  const seen = new Set<number>();
  for (const value of body.places) {
    const row = value as Record<string, unknown> | null;
    if (!row || row.active !== true) continue;
    if (!positive(row.siteID) || seen.has(row.siteID)) throw new Error("starting_prices_unavailable");
    seen.add(row.siteID);
    const fields = startingPriceFields(row);
    if (supplierStartingPrice(fields) !== null) result[`${world === "vacations" ? "vacation" : "event"}-${row.siteID}`] = fields;
  }
  if (!seen.size) throw new Error("starting_prices_unavailable");
  return result;
}

export function validStartingPriceMap(world: StartingPriceWorld, value: unknown): value is StartingPriceMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  const prefix = world === "vacations" ? "vacation" : "event";
  return entries.length <= 10_000 && entries.every(([key, fields]) => {
    if (!new RegExp(`^${prefix}-[1-9]\\d*$`).test(key) || !fields || typeof fields !== "object" || Array.isArray(fields)) return false;
    return Object.keys(fields).length > 0 && Object.entries(fields).every(([name, price]) => ["startPriceWinter", "startPriceSummer"].includes(name) && positive(price));
  });
}

export function publishedStartingPrices(world: StartingPriceWorld, prices: StartingPriceMap, ids: ReadonlySet<number>): StartingPriceMap {
  const prefix = world === "vacations" ? "vacation-" : "event-";
  return Object.fromEntries(Object.entries(prices).filter(([slug]) => slug.startsWith(prefix) && ids.has(Number(slug.slice(prefix.length)))));
}

/**
 * Read only the two approved seasonal fields from the accepted supplier
 * generation. The catalog generation itself is populated by the supplier API,
 * so public browsing does not need to download the multi-megabyte raw feed on
 * every cache refresh.
 */
export async function readAcceptedStartingPriceCatalog(db: D1Database, world: StartingPriceWorld): Promise<StartingPriceMap> {
  const state = await readSupplierCatalogState(db, world);
  if (!state?.activeRunId) throw new Error("starting_prices_unavailable");
  const rows = await db.prepare(`SELECT supplier_id AS supplierId,
    json_extract(summary_json, '$.startPriceWinter') AS startPriceWinter,
    json_extract(summary_json, '$.startPriceSummer') AS startPriceSummer
    FROM supplier_catalog_entries WHERE run_id = ? AND world = ? ORDER BY supplier_id`)
    .bind(state.activeRunId, world).all<{ supplierId: number; startPriceWinter: unknown; startPriceSummer: unknown }>();
  if (rows.results.length !== state.activeCount) throw new Error("catalog_active_generation_incomplete");
  const prefix = world === "vacations" ? "vacation" : "event";
  const prices: StartingPriceMap = {};
  for (const row of rows.results) {
    if (!positive(row.supplierId)) throw new Error("starting_prices_unavailable");
    const fields = startingPriceFields(row);
    if (supplierStartingPrice(fields) !== null) prices[`${prefix}-${row.supplierId}`] = fields;
  }
  return prices;
}

export async function fetchStartingPriceCatalog(world: StartingPriceWorld, token: string, fetchImpl: typeof fetch = fetch): Promise<StartingPriceMap> {
  if (!token) throw new Error("starting_prices_unavailable");
  const response = await fetchImpl(`https://bizonline.co.il/api/ai/vii/${world}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok || !response.body) throw new Error("starting_prices_unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 10 * 1024 * 1024) throw new Error("starting_prices_unavailable");
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
    return startingPriceCatalog(world, JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } finally { await reader.cancel().catch(() => {}); }
}
