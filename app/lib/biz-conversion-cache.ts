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
  cacheKey?: string;
  world: string;
  siteID: number;
  fromDay: string;
  tillDay: string;
  payload: string;
  savedAt: string;
  staleAfter: string;
};

type FailureRow = { cacheKey?: string; errorCode: string; savedAt: string; retryAt: string };
type CoverageRow = { coverageKey?: string; world: string; siteID: number; supplierCreatedAt: string; savedAt: string; staleAfter: string };
type ContactRow = { contactKey?: string; world: string; siteID: number; source: "whatsapp" | "maskyoo" | "form"; identified: number;
  orderID: string | null; orderPrice: number; customerKey: string | null; delay: number | null };

const pending = new Map<string, Promise<CachedBizConversion>>();
const initialized = new WeakMap<object, Promise<void>>();
// Versioned key: v2 intentionally represents every Biz portal. The previous
// cache used domain=section and therefore showed only a small fraction of the
// calls and WhatsApp conversations visible in the Biz report.
const keyFor = (world: ConversionWorld, siteID: number, from: string, till: string) => `${world}:${siteID}:${from}:${till}:all-portals-v2`;
const HEAVY_PAGE_SIZE = 100;
const LIGHT_PAGE_SIZE = 500;

async function pagedRows<T>(load: (cursor: string) => Promise<{ results: T[] }>, key: (row: T) => string | undefined) {
  const rows: T[] = [];
  let cursor = "";
  for (;;) {
    const page = await load(cursor);
    rows.push(...page.results);
    if (!page.results.length) break;
    const next = key(page.results[page.results.length - 1]);
    if (!next || next <= cursor) break;
    cursor = next;
  }
  return rows;
}

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
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_biz_conversion_coverage_v1 (
      coverage_key TEXT PRIMARY KEY NOT NULL, world TEXT NOT NULL, site_id INTEGER NOT NULL,
      from_day TEXT NOT NULL, till_day TEXT NOT NULL, supplier_created_at TEXT NOT NULL,
      saved_at TEXT NOT NULL, stale_after TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_biz_conversion_coverage_range ON vii_biz_conversion_coverage_v1(from_day, till_day, world, site_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_biz_conversion_contacts_v1 (
      contact_key TEXT PRIMARY KEY NOT NULL, world TEXT NOT NULL, site_id INTEGER NOT NULL,
      source TEXT NOT NULL, contact_id INTEGER NOT NULL, contact_day TEXT NOT NULL,
      identified INTEGER NOT NULL, order_id TEXT, order_price REAL NOT NULL,
      customer_key TEXT, delay INTEGER, supplier_created_at TEXT NOT NULL, saved_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_biz_conversion_contacts_range ON vii_biz_conversion_contacts_v1(contact_day, world, site_id)"),
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
  const contacts = conversions.contacts || [];
  const aggregate: ConversionSummary = { ...conversions };
  delete aggregate.contacts;
  const coverageKey = `${world}:${conversions.siteID}:${from}:${till}`;
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
    db.prepare(`INSERT INTO vii_biz_conversion_coverage_v1
      (coverage_key, world, site_id, from_day, till_day, supplier_created_at, saved_at, stale_after)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(coverage_key) DO UPDATE SET supplier_created_at = excluded.supplier_created_at,
        saved_at = excluded.saved_at, stale_after = excluded.stale_after`)
      .bind(coverageKey, world, conversions.siteID, from, till, conversions.created, savedAt, staleAfter),
  ]);
  for (let offset = 0; offset < contacts.length; offset += 80) {
    await db.batch(await Promise.all(contacts.slice(offset, offset + 80).map(async (contact) => {
      const identity = (contact.phone || contact.internalEmail || "").replace(/\s+/g, "").toLowerCase();
      const customerKey = identity ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity))))
        .map((byte) => byte.toString(16).padStart(2, "0")).join("") : null;
      return db.prepare(`INSERT INTO vii_biz_conversion_contacts_v1
        (contact_key, world, site_id, source, contact_id, contact_day, identified, order_id, order_price,
          customer_key, delay, supplier_created_at, saved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(contact_key) DO UPDATE SET contact_day = excluded.contact_day, identified = excluded.identified,
          order_id = excluded.order_id, order_price = excluded.order_price, customer_key = excluded.customer_key,
          delay = excluded.delay, supplier_created_at = excluded.supplier_created_at, saved_at = excluded.saved_at`)
        .bind(`${world}:${conversions.siteID}:${contact.source}:${contact.id}`, world, conversions.siteID, contact.source,
          contact.id, contact.time.slice(0, 10), contact.phone || contact.internalEmail ? 1 : 0, contact.order?.orderID || null,
          contact.order?.price || 0, customerKey, contact.delay, conversions.created, savedAt);
    })));
  }
  return { conversions: aggregate, cache: { status: "saved" as const, savedAt, stale: false } };
}

function median(values: number[]) {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) / 2);
}

function derivedBucket(rows: ContactRow[]) {
  const contacts = rows.length;
  const converted = rows.filter((row) => row.orderID !== null);
  const orders = new Map<string, number>();
  for (const row of converted) if (row.orderID) orders.set(row.orderID, Math.max(orders.get(row.orderID) || 0, row.orderPrice));
  return { contacts, identified: rows.filter((row) => row.identified === 1).length, converted: converted.length,
    rate: contacts ? Math.round(converted.length / contacts * 1000) / 10 : null,
    customers: new Set(converted.map((row) => row.customerKey || row.orderID).filter(Boolean)).size,
    orders: orders.size, revenue: [...orders.values()].reduce((sum, price) => sum + price, 0),
    medianDelay: median(converted.flatMap((row) => row.delay === null ? [] : [row.delay])) };
}

async function loadCoveredBizConversions(db: D1Database, from: string, till: string, excluded: Set<string>, now: Date) {
  const coverageRows = await pagedRows<CoverageRow>((cursor) => db.prepare(`SELECT coverage_key AS coverageKey,
    world, site_id AS siteID, supplier_created_at AS supplierCreatedAt, saved_at AS savedAt,
    stale_after AS staleAfter FROM vii_biz_conversion_coverage_v1
    WHERE from_day <= ? AND till_day >= ? AND coverage_key > ?
    ORDER BY coverage_key LIMIT ?`).bind(from, till, cursor, LIGHT_PAGE_SIZE).all<CoverageRow>(), (row) => row.coverageKey);
  const selected = new Map<string, CoverageRow>();
  for (const row of coverageRows.sort((a, b) => b.savedAt.localeCompare(a.savedAt))) {
    const key = `${row.world}:${Number(row.siteID)}`;
    if (!excluded.has(key) && !selected.has(key)) selected.set(key, row);
  }
  if (!selected.size) return [];
  const events = await pagedRows<ContactRow>((cursor) => db.prepare(`SELECT contact_key AS contactKey,
    world, site_id AS siteID, source, identified, order_id AS orderID,
    order_price AS orderPrice, customer_key AS customerKey, delay FROM vii_biz_conversion_contacts_v1
    WHERE contact_day >= ? AND contact_day <= ? AND contact_key > ?
    ORDER BY contact_key LIMIT ?`).bind(from, till, cursor, LIGHT_PAGE_SIZE).all<ContactRow>(), (row) => row.contactKey);
  const bySite = new Map<string, ContactRow[]>();
  for (const row of events) {
    const key = `${row.world}:${Number(row.siteID)}`;
    if (!selected.has(key)) continue;
    const current = bySite.get(key) || [];
    current.push({ ...row, siteID: Number(row.siteID), identified: Number(row.identified), orderPrice: Number(row.orderPrice || 0),
      delay: row.delay === null ? null : Number(row.delay) });
    bySite.set(key, current);
  }
  return [...selected.entries()].map(([key, coverageRow]) => {
    const rows = bySite.get(key) || [];
    const all = derivedBucket(rows);
    const bucket = (source: ContactRow["source"]) => derivedBucket(rows.filter((row) => row.source === source));
    return { world: coverageRow.world as ConversionWorld, siteID: Number(coverageRow.siteID),
      conversions: { siteID: Number(coverageRow.siteID), from, till, domainID: null, created: coverageRow.supplierCreatedAt,
        count: rows.length, summary: { all, whatsapp: bucket("whatsapp"), maskyoo: bucket("maskyoo"), form: bucket("form") },
        clicks: { whatsapp: 0, showphone: 0, phone: 0 } },
      cache: { status: "fresh" as const, savedAt: coverageRow.savedAt, stale: Date.parse(coverageRow.staleAfter) <= now.getTime() } };
  });
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
  const rows = await pagedRows<FailureRow & { world: string; siteID: number }>((cursor) => db.prepare(`SELECT cache_key AS cacheKey,
    world, site_id AS siteID, error_code AS errorCode, saved_at AS savedAt, retry_at AS retryAt
    FROM vii_biz_conversion_failures_v1 WHERE from_day = ? AND till_day = ?
      AND cache_key LIKE '%:all-portals-v2' AND cache_key > ?
    ORDER BY cache_key LIMIT ?`).bind(from, till, cursor, LIGHT_PAGE_SIZE).all<FailureRow & { world: string; siteID: number }>(), (row) => row.cacheKey);
  return rows.flatMap((row) => {
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
  // D1 may cap a response before every large JSON payload fits. Keyset pagination is
  // mandatory here: a partial page silently understated calls, WhatsApp and orders.
  const rows = await pagedRows<CacheRow>((cursor) => db.prepare(`SELECT cache_key AS cacheKey,
    world, site_id AS siteID, from_day AS fromDay, till_day AS tillDay,
    payload, saved_at AS savedAt, stale_after AS staleAfter
    FROM vii_biz_conversion_snapshots_v1 WHERE from_day = ? AND till_day = ?
      AND cache_key LIKE '%:all-portals-v2' AND cache_key > ?
    ORDER BY cache_key LIMIT ?`).bind(from, till, cursor, HEAVY_PAGE_SIZE).all<CacheRow>(), (row) => row.cacheKey);
  const exact = rows.flatMap((row) => {
    const value = parsed(row, now);
    return value ? [{ world: row.world as ConversionWorld, siteID: Number(row.siteID), ...value }] : [];
  });
  const excluded = new Set(exact.map((row) => `${row.world}:${row.siteID}`));
  return [...exact, ...await loadCoveredBizConversions(db, from, till, excluded, now)];
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
