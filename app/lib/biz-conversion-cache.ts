import type { D1Database } from "../../types/cloudflare-runtime";
import { requiredRuntimeDatabase } from "./runtime-database.ts";
import { parseViiConversionSummary, type ConversionSummary, type ConversionWorld } from "./vii-conversions.ts";

const FRESH_FOR_MS = 6 * 60 * 60 * 1000;

export type BizConversionCacheStatus = "saved" | "fresh" | "stale_fallback";
export type CachedBizConversion = {
  conversions: ConversionSummary;
  cache: { status: BizConversionCacheStatus; savedAt: string; stale: boolean };
};

type CacheRow = {
  world: string;
  siteID: number;
  fromDay: string;
  tillDay: string;
  payload: string;
  savedAt: string;
  staleAfter: string;
};

const pending = new Map<string, Promise<CachedBizConversion>>();
const initialized = new WeakMap<object, Promise<void>>();
const keyFor = (world: ConversionWorld, siteID: number, from: string, till: string) => `${world}:${siteID}:${from}:${till}:section`;

async function ensureCache(db: D1Database) {
  const existing = initialized.get(db as object);
  if (existing) return existing;
  const initialization = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_biz_conversion_snapshots_v1 (
      cache_key TEXT PRIMARY KEY NOT NULL, world TEXT NOT NULL, site_id INTEGER NOT NULL,
      from_day TEXT NOT NULL, till_day TEXT NOT NULL, payload TEXT NOT NULL,
      supplier_created_at TEXT NOT NULL, saved_at TEXT NOT NULL, stale_after TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_biz_conversion_range ON vii_biz_conversion_snapshots_v1(from_day, till_day, world, site_id)"),
  ]).then(() => undefined).catch((error) => {
    initialized.delete(db as object);
    throw error;
  });
  initialized.set(db as object, initialization);
  return initialization;
}

function parsed(row: CacheRow | null): CachedBizConversion | null {
  if (!row) return null;
  try {
    const conversions = parseViiConversionSummary(JSON.parse(row.payload), { siteID: Number(row.siteID), from: row.fromDay, till: row.tillDay });
    return { conversions, cache: { status: "fresh", savedAt: row.savedAt, stale: Date.parse(row.staleAfter) <= Date.now() } };
  } catch {
    return null;
  }
}

async function readOne(db: D1Database, world: ConversionWorld, siteID: number, from: string, till: string) {
  const row = await db.prepare(`SELECT world, site_id AS siteID, from_day AS fromDay, till_day AS tillDay,
    payload, saved_at AS savedAt, stale_after AS staleAfter
    FROM vii_biz_conversion_snapshots_v1 WHERE cache_key = ?`)
    .bind(keyFor(world, siteID, from, till)).first<CacheRow>();
  return parsed(row);
}

async function save(db: D1Database, world: ConversionWorld, from: string, till: string, conversions: ConversionSummary, now: Date) {
  const savedAt = now.toISOString();
  const staleAfter = new Date(now.getTime() + FRESH_FOR_MS).toISOString();
  const aggregate: ConversionSummary = { ...conversions };
  delete aggregate.contacts;
  await db.prepare(`INSERT INTO vii_biz_conversion_snapshots_v1
    (cache_key, world, site_id, from_day, till_day, payload, supplier_created_at, saved_at, stale_after)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload,
      supplier_created_at = excluded.supplier_created_at, saved_at = excluded.saved_at,
      stale_after = excluded.stale_after`)
    .bind(keyFor(world, conversions.siteID, from, till), world, conversions.siteID, from, till,
      JSON.stringify(aggregate), conversions.created, savedAt, staleAfter).run();
  return { conversions: aggregate, cache: { status: "saved" as const, savedAt, stale: false } };
}

export async function bizConversionDatabase() {
  const db = await requiredRuntimeDatabase("biz_conversion_cache_unavailable");
  await ensureCache(db);
  return db;
}

export async function loadCachedBizConversions(db: D1Database, from: string, till: string) {
  await ensureCache(db);
  const result = await db.prepare(`SELECT world, site_id AS siteID, from_day AS fromDay, till_day AS tillDay,
    payload, saved_at AS savedAt, stale_after AS staleAfter
    FROM vii_biz_conversion_snapshots_v1 WHERE from_day = ? AND till_day = ?`)
    .bind(from, till).all<CacheRow>();
  return result.results.flatMap((row) => {
    const value = parsed(row);
    return value ? [{ world: row.world as ConversionWorld, siteID: Number(row.siteID), ...value }] : [];
  });
}

export async function cachedBizConversions(options: {
  db: D1Database;
  world: ConversionWorld;
  siteID: number;
  from: string;
  till: string;
  forceRefresh?: boolean;
  fetcher: () => Promise<ConversionSummary>;
  now?: Date;
}): Promise<CachedBizConversion> {
  await ensureCache(options.db);
  const cacheKey = keyFor(options.world, options.siteID, options.from, options.till);
  const existing = await readOne(options.db, options.world, options.siteID, options.from, options.till);
  if (existing && !existing.cache.stale && !options.forceRefresh) return existing;
  const active = pending.get(cacheKey);
  if (active) return active;
  const operation = (async () => {
    try {
      const conversions = await options.fetcher();
      return await save(options.db, options.world, options.from, options.till, conversions, options.now ?? new Date());
    } catch (error) {
      if (existing) return { ...existing, cache: { ...existing.cache, status: "stale_fallback" as const, stale: true } };
      throw error;
    } finally {
      pending.delete(cacheKey);
    }
  })();
  pending.set(cacheKey, operation);
  return operation;
}
