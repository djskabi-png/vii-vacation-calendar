import type { D1Database } from "../../types/cloudflare-runtime";

export type AdminReportCacheMeta = {
  status: "saved" | "fresh" | "stale_fallback" | "bypassed";
  savedAt: string;
  stale: boolean;
};

type CacheRow = { payload: string; savedAt: string; freshUntil: string; staleUntil: string };
const initialized = new WeakMap<object, Promise<void>>();
const pending = new Map<string, Promise<{ value: unknown; cache: AdminReportCacheMeta }>>();

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function ensureSchema(db: D1Database) {
  const existing = initialized.get(db as object);
  if (existing) return existing;
  const operation = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_admin_report_cache_v1 (
      cache_key TEXT PRIMARY KEY NOT NULL, family TEXT NOT NULL, parameters TEXT NOT NULL,
      payload TEXT NOT NULL, saved_at TEXT NOT NULL, fresh_until TEXT NOT NULL, stale_until TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_admin_report_cache_family ON vii_admin_report_cache_v1(family, saved_at)"),
  ]).then(() => undefined).catch((error) => { initialized.delete(db as object); throw error; });
  initialized.set(db as object, operation);
  return operation;
}

export async function cachedAdminReport<T>(options: {
  db: D1Database;
  family: string;
  parameters: Record<string, unknown>;
  freshForMs: number;
  staleForMs?: number;
  immutable?: boolean;
  deferRefresh?: (operation: Promise<void>) => void;
  forceRefresh?: boolean;
  loader: () => Promise<T>;
  now?: Date;
}): Promise<{ value: T; cache: AdminReportCacheMeta }> {
  const parameters = stable(options.parameters);
  const cacheKey = `${options.family}:${parameters}`;
  const now = options.now ?? new Date();
  let row: CacheRow | null = null;
  try {
    await ensureSchema(options.db);
    row = await options.db.prepare(`SELECT payload, saved_at AS savedAt, fresh_until AS freshUntil, stale_until AS staleUntil
      FROM vii_admin_report_cache_v1 WHERE cache_key = ?`).bind(cacheKey).first<CacheRow>();
  } catch {
    const value = await options.loader();
    return { value, cache: { status: "bypassed", savedAt: now.toISOString(), stale: false } };
  }
  const parsed = (() => { try { return row ? JSON.parse(row.payload) as T : null; } catch { return null; } })();
  if (parsed !== null && (options.immutable || Date.parse(row!.freshUntil) > now.getTime()) && !options.forceRefresh) {
    return { value: parsed, cache: { status: "fresh", savedAt: row!.savedAt, stale: false } };
  }
  const active = pending.get(cacheKey);
  if (active) {
    if (parsed !== null && !options.forceRefresh && options.deferRefresh) {
      options.deferRefresh(active.then(() => undefined).catch(() => undefined));
      return { value: parsed, cache: { status: "stale_fallback", savedAt: row!.savedAt, stale: true } };
    }
    return active as Promise<{ value: T; cache: AdminReportCacheMeta }>;
  }
  const refresh = () => (async () => {
    try {
      const value = await options.loader();
      try {
        const payload = JSON.stringify(value);
        if (payload.length > 5_000_000) throw new Error("admin_report_cache_payload_too_large");
        const savedAt = now.toISOString();
        const freshUntil = options.immutable ? "9999-12-31T23:59:59.999Z" : new Date(now.getTime() + options.freshForMs).toISOString();
        const staleUntil = options.immutable ? "9999-12-31T23:59:59.999Z" : new Date(now.getTime() + (options.staleForMs ?? 30 * 86400_000)).toISOString();
        await options.db.prepare(`INSERT INTO vii_admin_report_cache_v1
          (cache_key, family, parameters, payload, saved_at, fresh_until, stale_until) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, saved_at = excluded.saved_at,
            fresh_until = excluded.fresh_until, stale_until = excluded.stale_until`)
          .bind(cacheKey, options.family, parameters, payload, savedAt, freshUntil, staleUntil).run();
        return { value, cache: { status: "saved" as const, savedAt, stale: false } };
      } catch {
        return { value, cache: { status: "bypassed" as const, savedAt: now.toISOString(), stale: false } };
      }
    } catch (error) {
      if (parsed !== null && Date.parse(row!.staleUntil) > now.getTime()) {
        return { value: parsed, cache: { status: "stale_fallback" as const, savedAt: row!.savedAt, stale: true } };
      }
      throw error;
    } finally {
      pending.delete(cacheKey);
    }
  })();
  if (parsed !== null && !options.forceRefresh && options.deferRefresh) {
    const operation = refresh();
    pending.set(cacheKey, operation as Promise<{ value: unknown; cache: AdminReportCacheMeta }>);
    options.deferRefresh(operation.then(() => undefined).catch(() => undefined));
    return { value: parsed, cache: { status: "stale_fallback", savedAt: row!.savedAt, stale: true } };
  }
  const operation = refresh();
  pending.set(cacheKey, operation as Promise<{ value: unknown; cache: AdminReportCacheMeta }>);
  return operation;
}
