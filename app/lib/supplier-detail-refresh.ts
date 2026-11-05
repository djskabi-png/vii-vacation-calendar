import type { SupplierCatalogEntry } from "./supplier-catalog-store.ts";

type RefreshMeta = { checkedAt?: string; attemptedAt?: string; retryAfter?: string };
const DAY = 86_400_000;
const BACKOFF = 6 * 60 * 60 * 1000;

function meta(entry?: SupplierCatalogEntry): RefreshMeta {
  const value = entry?.detail && typeof entry.detail === "object" ? (entry.detail as Record<string, unknown>)._viiCatalog : null;
  return value && typeof value === "object" && !Array.isArray(value) ? value as RefreshMeta : {};
}
function time(value: unknown, now: number) {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= now ? parsed : null;
}

export function selectDetailRefreshIds(previous: readonly SupplierCatalogEntry[], activeIds: readonly number[], limit: number, now: Date,
  options: { freshMs?: number; force?: boolean } = {}) {
  const nowMs = now.getTime();
  const freshMs = options.freshMs ?? 7 * DAY;
  if(!Number.isFinite(nowMs)||!Number.isFinite(limit)||!Number.isSafeInteger(freshMs)||freshMs<0)return [];
  const old = new Map(previous.map((entry) => [entry.supplierId, entry]));
  const candidates = [...new Set(activeIds)].filter((id) => Number.isSafeInteger(id) && id > 0).flatMap((id) => {
    const entry = old.get(id); const info = meta(entry); const checked = time(info.checkedAt, nowMs);
    const retryAfter = typeof info.retryAfter==='string'?Date.parse(info.retryAfter):NaN;
    if (Number.isFinite(retryAfter)&&retryAfter>nowMs&&retryAfter<=nowMs+BACKOFF) return [];
    if (!options.force && checked !== null && nowMs - checked < freshMs) return [];
    return [{ id, checked: checked ?? -1, attempted:time(info.attemptedAt,nowMs)??-1 }];
  });
  return candidates.sort((a, b) => a.checked - b.checked || a.attempted-b.attempted || a.id - b.id).slice(0, Math.max(0, Math.min(48,Math.floor(limit)))).map((item) => item.id);
}

export function stampDetailRefresh(entry: SupplierCatalogEntry, now: Date, options: { verified: boolean }): SupplierCatalogEntry {
  const detail = entry.detail && typeof entry.detail === "object" ? entry.detail as Record<string, unknown> : {};
  const previous = meta(entry);
  const iso = now.toISOString();
  const nextMeta = options.verified
    ? { ...previous, checkedAt: iso, attemptedAt: iso, retryAfter: undefined }
    : { ...previous, attemptedAt: iso, retryAfter: new Date(now.getTime() + BACKOFF).toISOString() };
  const cleaned = Object.fromEntries(Object.entries(nextMeta).filter(([, value]) => value !== undefined));
  return { ...entry, detail: { ...detail, _viiCatalog: cleaned } };
}
