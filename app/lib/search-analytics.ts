import type { D1Database } from "../../types/cloudflare-runtime";
import { requiredRuntimeDatabase } from "./runtime-database.ts";
import { searchLocationOptions } from "../data/search-taxonomy.ts";
import { searchLocationSlug } from "../data/world-search-landings.ts";
import { publicSearchPagePath } from "./search-page-url-policy.ts";

export const searchWorlds = ["vacation", "events", "spa", "hourly"] as const;
export type SearchWorld = (typeof searchWorlds)[number];
export type SearchFilterValue = string | number | boolean;
export type SearchDemandEvent = {
  eventId: string;
  world: SearchWorld;
  location: string;
  hasDate: boolean;
  pagePath: string | null;
  resultCount: number | null;
  sessionId: string | null;
  filters: Record<string, SearchFilterValue>;
};

const filterKeys: Record<SearchWorld, Set<string>> = {
  vacation: new Set(["type", "guests", "bedrooms", "accessible", "features", "online"]),
  events: new Set(["type", "eventType", "guests", "noise", "accessible", "hours"]),
  spa: new Set(["experience", "package", "guests", "accessible"]),
  hourly: new Set(["maxPrice", "features", "accessible"]),
};

const filterSlugs: Record<string, string> = {
  "אירוע משפחתי": "family-event",
  "אירוע עסקי": "business-event",
  "יום הולדת": "birthday",
  "בר מצווה": "bar-mitzvah",
  "בת מצווה": "bat-mitzvah",
  "חתונה": "wedding",
  "ברית": "brit",
  "מסיבה": "party",
  "לופט": "loft",
  "וילה": "villa",
  "מתחם אירועים": "event-venue",
};

export function validSearchWorld(value: unknown): value is SearchWorld {
  return typeof value === "string" && searchWorlds.includes(value as SearchWorld);
}

function normalizeLocation(world: SearchWorld, value: string) {
  const location = value.trim();
  const known = searchLocationOptions(world);
  return known.includes(location) ? location : location === "" || location === "הכל" || location === "כל הארץ" ? "כל הארץ" : "אחר";
}

function safeCategory(value: unknown): SearchFilterValue | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10000) return Math.round(value);
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text || text.length > 60 || /[@<>\\/]|https?:|\b\d{6,}\b/i.test(text)) return null;
  return text;
}

function normalizeFilters(world: SearchWorld, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const filters: Record<string, SearchFilterValue> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!filterKeys[world].has(key)) continue;
    const normalized = safeCategory(raw);
    if (normalized !== null && normalized !== false && normalized !== "" && normalized !== "הכל") filters[key] = normalized;
  }
  return Object.fromEntries(Object.entries(filters).sort(([a], [b]) => a.localeCompare(b)));
}

export function parseSearchEvent(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.eventId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(row.eventId) ||
    row.eventId.length > 50 || !validSearchWorld(row.world) || typeof row.location !== "string" ||
    row.location.length > 80 || typeof row.hasDate !== "boolean") return null;
  return { eventId: row.eventId, world: row.world, location: normalizeLocation(row.world, row.location), hasDate: row.hasDate };
}

export function parseSearchDemandEvent(value: unknown): SearchDemandEvent | null {
  const base = parseSearchEvent(value);
  if (!base || !value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const pagePath = typeof row.pagePath === "string" && row.pagePath.startsWith("/") && row.pagePath.length <= 500 && !/[<>]/.test(row.pagePath)
    ? row.pagePath : null;
  const resultCount = Number.isSafeInteger(row.resultCount) && Number(row.resultCount) >= 0 && Number(row.resultCount) <= 10000
    ? Number(row.resultCount) : null;
  const sessionId = typeof row.sessionId === "string" && /^[0-9a-f-]{20,50}$/i.test(row.sessionId) ? row.sessionId : null;
  return { ...base, pagePath, resultCount, sessionId, filters: normalizeFilters(base.world, row.filters) };
}

function canonicalIntent(event: SearchDemandEvent) {
  return JSON.stringify({ world: event.world, location: event.location, filters: event.filters });
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function opportunityTitle(event: SearchDemandEvent) {
  const subject = event.world === "events" ? "מקומות לאירועים" : event.world === "vacation" ? "מקומות נופש" : event.world === "spa" ? "חוויות ספא" : "חדרים לפי שעה";
  const intent = typeof event.filters.eventType === "string" ? event.filters.eventType : typeof event.filters.type === "string" ? event.filters.type : "";
  return `${subject}${intent ? ` ל${intent}` : ""}${event.location !== "כל הארץ" && event.location !== "אחר" ? ` ב${event.location}` : " בישראל"}`;
}

function slugToken(value: SearchFilterValue | undefined) {
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? "yes" : "";
  if (typeof value === "number") return String(value);
  return filterSlugs[value] || "";
}

export async function opportunityIdentity(event: SearchDemandEvent) {
  const intent = canonicalIntent(event);
  const hash = await sha256(intent);
  const location = searchLocationSlug(event.location) || (event.location === "כל הארץ" ? "israel" : "search");
  const filter = slugToken(event.filters.eventType) || slugToken(event.filters.type) || slugToken(event.filters.experience);
  const slug = [filter, location].filter(Boolean).join("-") + (filter ? "" : `-${hash.slice(0, 8)}`);
  return { id: `search-${hash.slice(0, 24)}`, canonicalKey: hash, proposedPath: publicSearchPagePath(event.world, slug), suggestedTitle: opportunityTitle(event) };
}

export async function searchAnalyticsDatabase(): Promise<D1Database> {
  const db = await requiredRuntimeDatabase("search_analytics_database_unavailable");
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_search_events (
      event_id TEXT PRIMARY KEY NOT NULL, world TEXT NOT NULL, location TEXT NOT NULL,
      has_date INTEGER NOT NULL, internal INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_search_events_period ON vii_search_events(created_at, internal, world)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_search_demand_events (
      event_id TEXT PRIMARY KEY NOT NULL, opportunity_id TEXT NOT NULL, world TEXT NOT NULL, location TEXT NOT NULL,
      filters_json TEXT NOT NULL, page_path TEXT NOT NULL, result_count INTEGER NOT NULL, zero_result INTEGER NOT NULL,
      has_date INTEGER NOT NULL DEFAULT 0, session_id TEXT, internal INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_search_demand_period ON vii_search_demand_events(created_at, internal, opportunity_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_search_page_opportunities (
      id TEXT PRIMARY KEY NOT NULL, canonical_key TEXT UNIQUE NOT NULL, world TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'he',
      location TEXT NOT NULL, filters_json TEXT NOT NULL, source_path TEXT NOT NULL, proposed_path TEXT NOT NULL,
      suggested_title TEXT NOT NULL, latest_result_count INTEGER NOT NULL DEFAULT 0, first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL, search_count INTEGER NOT NULL DEFAULT 0, zero_result_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending', assignee TEXT, title TEXT, meta_title TEXT, meta_description TEXT, h1 TEXT,
      summary TEXT, body TEXT, faq_json TEXT NOT NULL DEFAULT '[]', slug TEXT, canonical_path TEXT,
      robots_index INTEGER NOT NULL DEFAULT 0, scheduled_at TEXT, published_at TEXT, version INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT, updated_by TEXT)`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_search_opportunity_status ON vii_search_page_opportunities(status, last_seen_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_search_page_opportunity_versions (
      id TEXT PRIMARY KEY NOT NULL, opportunity_id TEXT NOT NULL, version INTEGER NOT NULL, snapshot_json TEXT NOT NULL,
      action TEXT NOT NULL, actor_email TEXT NOT NULL, created_at TEXT NOT NULL)`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_vii_search_opportunity_version ON vii_search_page_opportunity_versions(opportunity_id, version)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_search_page_publications (
      opportunity_id TEXT PRIMARY KEY NOT NULL, canonical_path TEXT UNIQUE NOT NULL, locale TEXT NOT NULL, world TEXT NOT NULL,
      snapshot_json TEXT NOT NULL, scheduled_at TEXT, published_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
  ]);
  await db.prepare("ALTER TABLE vii_search_demand_events ADD COLUMN has_date INTEGER NOT NULL DEFAULT 0").run().catch(() => undefined);
  return db;
}

export async function saveSearchEvent(db: D1Database, value: SearchDemandEvent | ReturnType<typeof parseSearchEvent>, internal: boolean) {
  if (!value) throw new Error("invalid_search_event");
  const at = new Date().toISOString();
  await db.prepare(`INSERT OR IGNORE INTO vii_search_events
    (event_id, world, location, has_date, internal, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(value.eventId, value.world, value.location, value.hasDate ? 1 : 0, internal ? 1 : 0, at).run();
  if (!("resultCount" in value) || value.resultCount === null || !value.pagePath) return;
  const identity = await opportunityIdentity(value);
  const inserted = await db.prepare(`INSERT OR IGNORE INTO vii_search_demand_events
    (event_id, opportunity_id, world, location, filters_json, page_path, result_count, zero_result, has_date, session_id, internal, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING event_id`)
    .bind(value.eventId, identity.id, value.world, value.location, JSON.stringify(value.filters), value.pagePath,
      value.resultCount, value.resultCount === 0 ? 1 : 0, value.hasDate ? 1 : 0, value.sessionId, internal ? 1 : 0, at).first<{ event_id: string }>();
  if (!inserted) return;
  const publicSearchCount = internal ? 0 : 1;
  const publicZeroResultCount = internal ? 0 : value.resultCount === 0 ? 1 : 0;
  await db.prepare(`INSERT INTO vii_search_page_opportunities
    (id, canonical_key, world, location, filters_json, source_path, proposed_path, suggested_title, latest_result_count,
     first_seen_at, last_seen_at, search_count, zero_result_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(canonical_key) DO UPDATE SET source_path = excluded.source_path,
      latest_result_count = excluded.latest_result_count, last_seen_at = excluded.last_seen_at,
      search_count = vii_search_page_opportunities.search_count + excluded.search_count,
      zero_result_count = vii_search_page_opportunities.zero_result_count + excluded.zero_result_count`)
    .bind(identity.id, identity.canonicalKey, value.world, value.location, JSON.stringify(value.filters), value.pagePath,
      identity.proposedPath, identity.suggestedTitle, value.resultCount, at, at, publicSearchCount, publicZeroResultCount).run();
}

export async function readSearchAnalytics(db: D1Database, days: number) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const recentColumns = `e.event_id AS eventId, e.opportunity_id AS opportunityId, e.world, e.location,
    e.filters_json AS filtersJson, e.page_path AS pagePath, e.result_count AS resultCount,
    e.zero_result AS zeroResult, e.has_date AS hasDate, e.created_at AS createdAt,
    o.suggested_title AS suggestedTitle, o.status`;
  const [total, dated, byWorld, byLocation, daily, opportunities, zeroResults, internalTotal, recentPublic, recentInternal, topIntents] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM vii_search_demand_events WHERE created_at >= ? AND internal = 0").bind(since).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM vii_search_demand_events WHERE created_at >= ? AND internal = 0 AND has_date = 1").bind(since).first<{ count: number }>(),
    db.prepare("SELECT world, COUNT(*) AS count FROM vii_search_demand_events WHERE created_at >= ? AND internal = 0 GROUP BY world ORDER BY count DESC").bind(since).all<{ world: string; count: number }>(),
    db.prepare("SELECT location, COUNT(*) AS count FROM vii_search_demand_events WHERE created_at >= ? AND internal = 0 GROUP BY location ORDER BY count DESC LIMIT 12").bind(since).all<{ location: string; count: number }>(),
    db.prepare("SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count FROM vii_search_demand_events WHERE created_at >= ? AND internal = 0 GROUP BY substr(created_at, 1, 10) ORDER BY date DESC LIMIT 31").bind(since).all<{ date: string; count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM vii_search_page_opportunities WHERE status IN ('draft','review') OR (status = 'pending' AND search_count > 0)").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM vii_search_demand_events WHERE created_at >= ? AND internal = 0 AND zero_result = 1").bind(since).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM vii_search_demand_events WHERE created_at >= ? AND internal = 1").bind(since).first<{ count: number }>(),
    db.prepare(`SELECT ${recentColumns} FROM vii_search_demand_events e JOIN vii_search_page_opportunities o ON o.id = e.opportunity_id
      WHERE e.created_at >= ? AND e.internal = 0 ORDER BY e.created_at DESC LIMIT 24`).bind(since).all<Record<string, unknown>>(),
    db.prepare(`SELECT ${recentColumns} FROM vii_search_demand_events e JOIN vii_search_page_opportunities o ON o.id = e.opportunity_id
      WHERE e.created_at >= ? AND e.internal = 1 ORDER BY e.created_at DESC LIMIT 24`).bind(since).all<Record<string, unknown>>(),
    db.prepare(`SELECT e.opportunity_id AS opportunityId, o.suggested_title AS suggestedTitle, e.world, e.location,
      o.filters_json AS filtersJson, o.source_path AS pagePath, o.latest_result_count AS resultCount,
      COUNT(*) AS searches, COUNT(DISTINCT e.session_id) AS uniqueSessions,
      SUM(e.zero_result) AS zeroResults, MAX(e.created_at) AS lastSeenAt, o.status
      FROM vii_search_demand_events e JOIN vii_search_page_opportunities o ON o.id = e.opportunity_id
      WHERE e.created_at >= ? AND e.internal = 0 GROUP BY e.opportunity_id ORDER BY searches DESC, lastSeenAt DESC LIMIT 12`).bind(since).all<Record<string, unknown>>(),
  ]);
  const hydrateRecent = (rows: Array<Record<string, unknown>>) => rows.map((row) => {
    const { filtersJson, ...rest } = row;
    let filters: Record<string, SearchFilterValue> = {};
    try { filters = JSON.parse(String(filtersJson || "{}")) as Record<string, SearchFilterValue>; } catch { filters = {}; }
    return { ...rest, filters, zeroResult: Number(row.zeroResult) === 1, hasDate: Number(row.hasDate) === 1 };
  });
  return { periodHours: days * 24, since, generatedAt: new Date().toISOString(), total: total?.count ?? 0,
    dated: dated?.count ?? 0, pendingOpportunities: opportunities?.count ?? 0, zeroResults: zeroResults?.count ?? 0,
    internalTotal: internalTotal?.count ?? 0, byWorld: byWorld.results, byLocation: byLocation.results, daily: daily.results,
    recentPublic: hydrateRecent(recentPublic.results), recentInternal: hydrateRecent(recentInternal.results), topIntents: hydrateRecent(topIntents.results) };
}
