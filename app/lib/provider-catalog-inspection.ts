type World = "vacations" | "events" | "rooms" | "spa";
type Dependencies = { secret: (name: "SERGEY_VII_API_TOKEN" | "SPAPLUS_VII_API_KEY") => Promise<string>; fetchImpl?: typeof fetch };
const fields = ["siteID", "siteid", "name", "title", "siteName", "active", "isActive", "published", "isPublished", "city", "area", "type", "facilityIds", "facility_ids", "accessoryIds", "facilities", "accessories", "features"];

/** Existing administrator identity only. Reads official source inventory without
 * staging, accepting, refreshing D1, exposing credentials or performing bookings. */
export async function inspectProviderCatalog(world: World, supplierIds: number[], dependencies: Dependencies) {
  if (!["vacations", "events", "rooms", "spa"].includes(world) || !supplierIds.length || supplierIds.length > 4 || supplierIds.some(id => !Number.isSafeInteger(id) || id < 1)) throw Error("invalid_inspection");
  const key = await dependencies.secret(world === "spa" ? "SPAPLUS_VII_API_KEY" : "SERGEY_VII_API_TOKEN");
  if (!key) throw Error("provider_inspection_unavailable");
  const url = world === "spa" ? new URL("https://www.spaplus.co.il/vii/") : new URL(`https://bizonline.co.il/api/ai/vii/${world}`);
  const headers = new Headers({ Accept: "application/json" });
  if (world === "spa") { url.searchParams.set("action", "sites"); url.searchParams.set("key", key); }
  else headers.set("Authorization", `Bearer ${key}`);
  const response = await (dependencies.fetchImpl || fetch)(url, { headers, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok || !response.body) throw Error("provider_inspection_unavailable");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 32_000_000) throw Error("provider_inspection_unavailable"); chunks.push(part.value); } }
  finally { await reader.cancel().catch(() => {}); }
  const buffer = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  const payload = JSON.parse(new TextDecoder().decode(buffer));
  const rows: Record<string, unknown>[] = world === "spa" && payload.status === "ok" && payload.sites && !Array.isArray(payload.sites)
    ? Object.values(payload.sites) : Array.isArray(payload.places) ? payload.places : [];
  if (!rows.length || rows.length > 10_000) throw Error("provider_inspection_unavailable");
  const idOf = (row: Record<string, unknown>) => Number(world === "spa" ? row.siteid : row.siteID);
  if (rows.some(row => !row || typeof row !== "object" || !Number.isSafeInteger(idOf(row)) || idOf(row) < 1)) throw Error("provider_inspection_unavailable");
  const facilities = (value: unknown): unknown => {
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "string") return value.slice(0, 1000);
    if (Array.isArray(value)) return value.slice(0, 500).map(facilities);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => /^(?:\d+|id|facilityId|accessoryId|label|title|name|description)$/.test(key)).slice(0, 500).map(([key,item])=>[key,facilities(item)]));
    return null;
  };
  const requested = supplierIds.map(id => {
    const row = rows.find(value => idOf(value) === id);
    return { supplierId: id, found: !!row, ...(row ? { fields: Object.fromEntries(fields.filter(field => Object.hasOwn(row, field)).map(field => [field, facilities(row[field])])) } : {}) };
  });
  return { readOnly: true, world, observedAt: new Date().toISOString(), source: world === "spa" ? "spaplus-official-sites" : "sergey-official-catalog", count: rows.length,
    ids: rows.map(idOf), activeIds: world === "spa" ? null : rows.filter(row => row.active === true).map(idOf), requested };
}
