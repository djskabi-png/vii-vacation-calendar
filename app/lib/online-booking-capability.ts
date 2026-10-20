/** Discovery capability only. Never a price, availability quote or booking authorization. */
export const CAPABILITY_FRESH_MS = 86_400_000;
export const CAPABILITY_MAX_AGE_MS = 7 * CAPABILITY_FRESH_MS;
export type OnlineCapabilityMap = Record<string, { checkedAt: number }>;

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
  const from = new Date(now + 2 * CAPABILITY_FRESH_MS).toISOString().slice(0, 10);
  return { from, nights: 1, rooms: [{ adults: 2 }] };
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
  const response = await fetchImpl("https://bizonline.co.il/api/ai/vii/vacations/search", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(capabilityProbe(now)), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok || !response.body) throw new Error("capabilities_unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength; if (size > 10 * 1024 * 1024) throw new Error("invalid_capabilities");
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
    return mergeCapabilityProbe(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), previous, now);
  } finally { await reader.cancel().catch(() => {}); }
}
