import type { D1Database } from "../../types/cloudflare-runtime";
import { searchLocationOptions } from "../data/search-taxonomy.ts";

export const searchWorlds = ["vacation", "events", "spa", "hourly"] as const;
export type SearchWorld = (typeof searchWorlds)[number];

export function validSearchWorld(value: unknown): value is SearchWorld {
  return typeof value === "string" && searchWorlds.includes(value as SearchWorld);
}

export function parseSearchEvent(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.eventId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(row.eventId) ||
    row.eventId.length > 50 || !validSearchWorld(row.world) || typeof row.location !== "string" ||
    row.location.length > 80 || typeof row.hasDate !== "boolean") return null;
  const location = row.location.trim();
  const known = searchLocationOptions(row.world);
  return { eventId: row.eventId, world: row.world,
    location: known.includes(location) ? location : location === "" || location === "כל הארץ" ? "כל הארץ" : "אחר",
    hasDate: row.hasDate };
}

export async function searchAnalyticsDatabase(): Promise<D1Database> {
  const runtime = await import("cloudflare:workers");
  const db = (runtime.env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("search_analytics_database_unavailable");
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_search_events (
      event_id TEXT PRIMARY KEY NOT NULL,
      world TEXT NOT NULL,
      location TEXT NOT NULL,
      has_date INTEGER NOT NULL,
      internal INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_search_events_period ON vii_search_events(created_at, internal, world)"),
  ]);
  return db;
}

export async function saveSearchEvent(db: D1Database, value: ReturnType<typeof parseSearchEvent>, internal: boolean) {
  if (!value) throw new Error("invalid_search_event");
  await db.prepare(`INSERT OR IGNORE INTO vii_search_events
    (event_id, world, location, has_date, internal, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(value.eventId, value.world, value.location, value.hasDate ? 1 : 0, internal ? 1 : 0, new Date().toISOString()).run();
}

export async function readSearchAnalytics(db: D1Database, days: number) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const [total, dated, byWorld, byLocation, daily] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM vii_search_events WHERE created_at >= ? AND internal = 0").bind(since).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM vii_search_events WHERE created_at >= ? AND internal = 0 AND has_date = 1").bind(since).first<{ count: number }>(),
    db.prepare("SELECT world, COUNT(*) AS count FROM vii_search_events WHERE created_at >= ? AND internal = 0 GROUP BY world ORDER BY count DESC").bind(since).all<{ world: string; count: number }>(),
    db.prepare("SELECT location, COUNT(*) AS count FROM vii_search_events WHERE created_at >= ? AND internal = 0 GROUP BY location ORDER BY count DESC LIMIT 12").bind(since).all<{ location: string; count: number }>(),
    db.prepare("SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count FROM vii_search_events WHERE created_at >= ? AND internal = 0 GROUP BY substr(created_at, 1, 10) ORDER BY date DESC LIMIT 31").bind(since).all<{ date: string; count: number }>(),
  ]);
  return { periodHours: days * 24, since, generatedAt: new Date().toISOString(), total: total?.count ?? 0,
    dated: dated?.count ?? 0, byWorld: byWorld.results, byLocation: byLocation.results, daily: daily.results };
}

