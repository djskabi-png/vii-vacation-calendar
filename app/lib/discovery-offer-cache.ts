import type { D1Database } from "../../types/cloudflare-runtime";
import { getRequestExecutionContext } from "vinext/shims/request-context";

export type DiscoveryCacheResult<T> = { value: T; cache: { status: "fresh" | "refreshed" | "stale"; checkedAt: string } };
type Options<T> = { key: readonly unknown[]; load: (previous?: T) => Promise<T>; db?: D1Database | null; now?: () => number; validate?: (value: unknown) => boolean; policy?: { freshMs: number; staleMs: number } };
type Row = { payload: string | null; checked_at: number; stale_until: number; retry_after: number; lease_until: number };
const TABLE = "vii_discovery_offer_cache_v1";
const FRESH = 900_000, STALE = 86_400_000, COOLDOWN = 120_000, LEASE = 60_000, MAX_BYTES = 1_048_576;
const memory = new Map<string, Row>();
const flights = new WeakMap<D1Database, Map<string, Promise<DiscoveryCacheResult<unknown>>>>();
const localFlights = new Map<string, Promise<DiscoveryCacheResult<unknown>>>();
function policy<T>(options: Options<T>) {
  const value = options.policy ?? { freshMs: FRESH, staleMs: STALE };
  if (!Number.isSafeInteger(value.freshMs) || value.freshMs < 1 || !Number.isSafeInteger(value.staleMs)
    || value.staleMs < value.freshMs || value.staleMs > 30 * 86_400_000) return unavailable();
  return value;
}

function unavailable(): never { throw new Error("discovery_unavailable"); }
function result<T>(value: T, row: Row, status: "fresh" | "refreshed" | "stale"): DiscoveryCacheResult<T> {
  return { value: structuredClone(value), cache: { status, checkedAt: new Date(row.checked_at).toISOString() } };
}
function parse<T>(row: Row | null | undefined, options: Options<T>, now: number): T | undefined {
  if (!row?.payload || row.checked_at > now || row.stale_until <= now || row.payload.length > MAX_BYTES) return undefined;
  try { const value = JSON.parse(row.payload); return value !== null && (!options.validate || options.validate(value)) ? value as T : undefined; } catch { return undefined; }
}
function payload<T>(value: T, options: Options<T>) {
  if (value === null || value === undefined || options.validate && !options.validate(value)) return unavailable();
  const encoded = JSON.stringify(value);
  if (!encoded || new TextEncoder().encode(encoded).length > MAX_BYTES) return unavailable();
  return encoded;
}
async function identity(key: readonly unknown[]) {
  const encoded = JSON.stringify(["discovery", 2, key]);
  if (encoded.length > 4096) return unavailable();
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(encoded))), n => n.toString(16).padStart(2, "0")).join("");
}
function remember(key: string, row: Row) {
  memory.delete(key); memory.set(key, row);
  while (memory.size > 16) memory.delete(memory.keys().next().value!);
}
async function read(db: D1Database, key: string) {
  return db.prepare(`SELECT payload, checked_at, stale_until, retry_after, lease_until FROM ${TABLE} WHERE cache_key = ?`).bind(key).first<Row>();
}
async function localRead<T>(key: string, options: Options<T>): Promise<DiscoveryCacheResult<T>> {
  const clock = options.now ?? Date.now, now = clock(), row = memory.get(key);
  const value = parse(row, options, now);
  if (value !== undefined && row && now < row.checked_at + policy(options).freshMs) return result(value, row, "fresh");
  if (row && now < row.retry_after) return value !== undefined ? result(value, row, "stale") : unavailable();
  try {
    const fresh = await options.load(value), checked = clock();
    const next = { payload: payload(fresh, options), checked_at: checked, stale_until: checked + policy(options).staleMs, retry_after: 0, lease_until: 0 };
    remember(key, next); return result(fresh, next, "refreshed");
  } catch {
    const failed = { ...(row ?? { payload: null, checked_at: 0, stale_until: 0, lease_until: 0 }), retry_after: clock() + COOLDOWN };
    remember(key, failed);
    const previous = parse(failed, options, clock());
    return previous !== undefined ? result(previous, failed, "stale") : unavailable();
  }
}
async function durableRead<T>(db: D1Database, key: string, options: Options<T>): Promise<DiscoveryCacheResult<T>> {
  const clock = options.now ?? Date.now;
  let now = clock(), row = await read(db, key), value = parse(row, options, now);
  if (row && value !== undefined && now < row.checked_at + policy(options).freshMs) return result(value, row, "fresh");
  if (row && now < row.retry_after) return value !== undefined ? result(value, row, "stale") : unavailable();
  if (!row) {
    // Admission is bounded even when every provider call fails. Never let cold
    // failure placeholders grow without limit or evict an active lease owner.
    // Long-lived daily evidence must not be evicted by a burst of short-lived
    // date/party offers. Still bounded by the same 512-row admission ceiling.
    await db.prepare(`DELETE FROM ${TABLE} WHERE cache_key IN (SELECT cache_key FROM ${TABLE} WHERE lease_until <= ? ORDER BY (stale_until > ? AND stale_until - checked_at > ?) DESC, checked_at DESC, cache_key LIMIT -1 OFFSET 511)`).bind(now, now, STALE).run();
    await db.prepare(`INSERT OR IGNORE INTO ${TABLE} (cache_key) SELECT ? WHERE (SELECT COUNT(*) FROM ${TABLE}) < 512`).bind(key).run();
  }
  const token = crypto.randomUUID();
  const leased = await db.prepare(`UPDATE ${TABLE} SET lease_until = ?, lease_token = ? WHERE cache_key = ? AND lease_until <= ? AND retry_after <= ? AND checked_at = ?`).bind(now + LEASE, token, key, now, now, row?.checked_at ?? 0).run();
  if (!leased.meta.changes) {
    if (row && value !== undefined) return result(value, row, "stale");
    for (const delay of [100, 200, 400, 800, 1600, 3200, 6400, 6400]) {
      row = await read(db, key); now = clock(); value = parse(row, options, now);
      if (row && value !== undefined) return result(value, row, now < row.checked_at + policy(options).freshMs ? "fresh" : "stale");
      if (!row || row.retry_after > now || row.lease_until <= now) return unavailable();
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return unavailable();
  }
  const refresh = async (): Promise<DiscoveryCacheResult<T>> => { try {
    const fresh = await options.load(value), checked = clock(), encoded = payload(fresh, options);
    const saved = await db.prepare(`UPDATE ${TABLE} SET payload = ?, checked_at = ?, stale_until = ?, retry_after = 0, lease_until = 0, lease_token = NULL WHERE cache_key = ? AND lease_token = ?`).bind(encoded, checked, checked + policy(options).staleMs, key, token).run();
    if (!saved.meta.changes) {
      const current = await read(db, key), currentValue = parse(current, options, clock());
      return current && currentValue !== undefined ? result(currentValue, current, "fresh") : unavailable();
    }
    await db.prepare(`DELETE FROM ${TABLE} WHERE cache_key IN (SELECT cache_key FROM ${TABLE} WHERE lease_until <= ? ORDER BY (stale_until > ? AND stale_until - checked_at > ?) DESC, checked_at DESC, cache_key LIMIT -1 OFFSET 512)`).bind(checked, checked, STALE).run().catch(() => {});
    return result(fresh, { payload: encoded, checked_at: checked, stale_until: checked + policy(options).staleMs, retry_after: 0, lease_until: 0 }, "refreshed");
  } catch {
    await db.prepare(`UPDATE ${TABLE} SET retry_after = ?, lease_until = 0, lease_token = NULL WHERE cache_key = ? AND lease_token = ?`).bind(clock() + COOLDOWN, key, token).run().catch(() => {});
    const current = await read(db, key), previous = parse(current, options, clock());
    return current && previous !== undefined ? result(previous, current, "stale") : unavailable();
  } };
  const context = getRequestExecutionContext();
  if (row && value !== undefined && context) {
    context.waitUntil(refresh().catch(() => {}));
    return result(value, row, "stale");
  }
  return refresh();
}
export async function cachedDiscovery<T>(options: Options<T>): Promise<DiscoveryCacheResult<T>> {
  policy(options);
  const key = await identity(options.key), db = options.db;
  let group = db ? flights.get(db) : localFlights;
  if (!group) { group = new Map(); flights.set(db!, group); }
  const pending = group.get(key);
  if (pending) return structuredClone(await pending) as DiscoveryCacheResult<T>;
  const operation = db ? durableRead(db, key, options) : localRead(key, options);
  group.set(key, operation as Promise<DiscoveryCacheResult<unknown>>);
  try { return await operation; } finally { if (group.get(key) === operation) group.delete(key); }
}
