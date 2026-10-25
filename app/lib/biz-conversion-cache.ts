import type { D1Database } from "../../types/cloudflare-runtime";
import { requiredRuntimeDatabase } from "./runtime-database.ts";
import { parseViiConversionSummary, type ConversionSummary, type ConversionWorld } from "./vii-conversions.ts";
import { isClosedReportPeriod } from "./report-date-policy.ts";

const LIVE_FRESH_FOR_MS = 30 * 60 * 1000;
const HISTORICAL_FRESH_FOR_MS = 7 * 86400_000;

export type BizConversionCacheStatus = "saved" | "fresh" | "stale_fallback";
export type CachedBizConversion = {
  conversions: ConversionSummary;
  cache: { status: BizConversionCacheStatus; savedAt: string; stale: boolean };
};

export type CachedBizConversionFailure = {
  error: string;
  cache: { status: "failure_cached"; savedAt: string; retryAt: string; stale: boolean };
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

type FailureRow = { errorCode: string; savedAt: string; retryAt: string };

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
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_biz_conversion_failures_v1 (
      cache_key TEXT PRIMARY KEY NOT NULL, world TEXT NOT NULL, site_id INTEGER NOT NULL,
      from_day TEXT NOT NULL, till_day TEXT NOT NULL, error_code TEXT NOT NULL,
      saved_at TEXT NOT NULL, retry_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_biz_conversion_failure_range ON vii_biz_conversion_failures_v1(from_day, till_day, world, site_id)"),
  ]).then(() => undefined).catch((error) => {
    initialized.delete(db as object);
    throw error;
  });
  initialized.set(db as object, initialization);
  return initialization;
}

function parsed(row: CacheRow | null, now = new Date()): CachedBizConversion | null {
  if (!row) return null;
  try {
    const conversions = parseViiConversionSummary(JSON.parse(row.payload), { siteID: Number(row.siteID), from: row.fromDay, till: row.tillDay });
    return { conversions, cache: { status: "fresh", savedAt: row.savedAt, stale: Date.parse(row.staleAfter) <= now.getTime() } };
  } catch {
    return null;
  }
}

async function readOne(db: D1Database, world: ConversionWorld, siteID: number, from: string, till: string, now = new Date()) {
  const row = await db.prepare(`SELECT world, site_id AS siteID, from_day AS fromDay, till_day AS tillDay,
    payload, saved_at AS savedAt, stale_after AS staleAfter
    FROM vii_biz_conversion_snapshots_v1 WHERE cache_key = ?`)
    .bind(keyFor(world, siteID, from, till)).first<CacheRow>();
  return parsed(row, now);
}

async function save(db: D1Database, world: ConversionWorld, from: string, till: string, conversions: ConversionSummary, now: Date) {
  const savedAt = now.toISOString();
  const freshForMs = isClosedReportPeriod(till, now) ? HISTORICAL_FRESH_FOR_MS : LIVE_FRESH_FOR_MS;
  const staleAfter = new Date(now.getTime() + freshForMs).toISOString();
  const aggregate: ConversionSummary = { ...conversions };
  delete aggregate.contacts;
  await db.batch([db.prepare(`INSERT INTO vii_biz_conversion_snapshots_v1
    (cache_key, world, site_id, from_day, till_day, payload, supplier_created_at, saved_at, stale_after)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload,
      supplier_created_at = excluded.supplier_created_at, saved_at = excluded.saved_at,
      stale_after = excluded.stale_after`)
    .bind(keyFor(world, conversions.siteID, from, till), world, conversions.siteID, from, till,
      JSON.stringify(aggregate), conversions.created, savedAt, staleAfter),
    db.prepare("DELETE FROM vii_biz_conversion_failures_v1 WHERE cache_key = ?")
      .bind(keyFor(world, conversions.siteID, from, till)),
  ]);
  return { conversions: aggregate, cache: { status: "saved" as const, savedAt, stale: false } };
}

function failureTtlMs(error: string) {
  if (error === "not_supported") return 30 * 86400_000;
  if (error === "invalid_request") return 86400_000;
  if (error === "invalid_response") return 60 * 60_000;
  return 6 * 60 * 60_000;
}

function parsedFailure(row: FailureRow | null, now = new Date()): CachedBizConversionFailure | null {
  if (!row || !row.errorCode || !row.savedAt || !row.retryAt) return null;
  return { error: row.errorCode, cache: { status: "failure_cached", savedAt: row.savedAt,
    retryAt: row.retryAt, stale: Date.parse(row.retryAt) <= now.getTime() } };
}

export async function readCachedBizConversionFailure(db: D1Database, world: ConversionWorld, siteID: number,
  from: string, till: string, now = new Date()) {
  await ensureCache(db);
  const row = await db.prepare(`SELECT error_code AS errorCode, saved_at AS savedAt, retry_at AS retryAt
    FROM vii_biz_conversion_failures_v1 WHERE cache_key = ?`)
    .bind(keyFor(world, siteID, from, till)).first<FailureRow>();
  return parsedFailure(row, now);
}

export async function loadCachedBizConversionFailures(db: D1Database, from: string, till: string, now = new Date()) {
  await ensureCache(db);
  const result = await db.prepare(`SELECT world, site_id AS siteID, error_code AS errorCode,
    saved_at AS savedAt, retry_at AS retryAt FROM vii_biz_conversion_failures_v1
    WHERE from_day = ? AND till_day = ?`).bind(from, till).all<FailureRow & { world: string; siteID: number }>();
  return result.results.flatMap((row) => {
    const value = parsedFailure(row, now);
    return value ? [{ world: row.world as ConversionWorld, siteID: Number(row.siteID), ...value }] : [];
  });
}

export async function saveBizConversionFailure(db: D1Database, options: { world: ConversionWorld; siteID: number;
  from: string; till: string; error: string; now?: Date }) {
  await ensureCache(db);
  const now = options.now ?? new Date();
  const savedAt = now.toISOString();
  const retryAt = new Date(now.getTime() + failureTtlMs(options.error)).toISOString();
  await db.prepare(`INSERT INTO vii_biz_conversion_failures_v1
    (cache_key, world, site_id, from_day, till_day, error_code, saved_at, retry_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET error_code = excluded.error_code,
      saved_at = excluded.saved_at, retry_at = excluded.retry_at`)
    .bind(keyFor(options.world, options.siteID, options.from, options.till), options.world, options.siteID,
      options.from, options.till, options.error, savedAt, retryAt).run();
  return { error: options.error, cache: { status: "failure_cached" as const, savedAt, retryAt, stale: false } };
}

export async function bizConversionDatabase() {
  const db = await requiredRuntimeDatabase("biz_conversion_cache_unavailable");
  await ensureCache(db);
  return db;
}

export async function loadCachedBizConversions(db: D1Database, from: string, till: string, now = new Date()) {
  await ensureCache(db);
  const result = await db.prepare(`SELECT world, site_id AS siteID, from_day AS fromDay, till_day AS tillDay,
    payload, saved_at AS savedAt, stale_after AS staleAfter
    FROM vii_biz_conversion_snapshots_v1 WHERE from_day = ? AND till_day = ?`)
    .bind(from, till).all<CacheRow>();
  return result.results.flatMap((row) => {
    const value = parsed(row, now);
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
  deferRefresh?: (operation: Promise<void>) => void;
}): Promise<CachedBizConversion> {
  await ensureCache(options.db);
  const cacheKey = keyFor(options.world, options.siteID, options.from, options.till);
  const now = options.now ?? new Date();
  const existing = await readOne(options.db, options.world, options.siteID, options.from, options.till, now);
  if (existing && !existing.cache.stale && !options.forceRefresh) return existing;
  const active = pending.get(cacheKey);
  if (active) {
    if (existing && !options.forceRefresh && options.deferRefresh) {
      options.deferRefresh(active.then(() => undefined).catch(() => undefined));
      return { ...existing, cache: { ...existing.cache, status: "stale_fallback", stale: true } };
    }
    return active;
  }
  const refresh = () => (async () => {
    try {
      const conversions = await options.fetcher();
      return await save(options.db, options.world, options.from, options.till, conversions, now);
    } catch (error) {
      if (existing) return { ...existing, cache: { ...existing.cache, status: "stale_fallback" as const, stale: true } };
      throw error;
    } finally {
      pending.delete(cacheKey);
    }
  })();
  if (existing && !options.forceRefresh && options.deferRefresh) {
    const operation = refresh();
    pending.set(cacheKey, operation);
    options.deferRefresh(operation.then(() => undefined).catch(() => undefined));
    return { ...existing, cache: { ...existing.cache, status: "stale_fallback", stale: true } };
  }
  const operation = refresh();
  pending.set(cacheKey, operation);
  return operation;
}
