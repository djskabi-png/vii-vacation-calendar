import type { D1Database } from "../../types/cloudflare-runtime";
import { spaLandings, spaLandingHref } from "../data/spa-landings.ts";
import { searchLocationOptions } from "../data/search-taxonomy.ts";
import { eventSearchHref, hourlySearchHref } from "../data/world-search-landings.ts";

export type SearchPageDefinition = { path: string; world: "spa" | "events" | "hourly"; title: string; description: string };
export type SearchPageStatus = "draft" | "published" | "scheduled";
export type SearchPageContent = { path: string; title: string; description: string; status: SearchPageStatus; scheduledAt: string | null; version: number; updatedAt: string; updatedBy: string };

const allSearchPageDefinitions: SearchPageDefinition[] = [
  { path: "/spas", world: "spa", title: "בתי ספא בישראל", description: "בוחרים אזור, תאריך וסוג חוויה ומוצאים את הספא שמתאים לכם." },
  ...spaLandings.map((landing) => ({ path: spaLandingHref(landing), world: "spa" as const, title: landing.title, description: landing.description })),
  ...searchLocationOptions("events").filter((location) => !["כל הארץ", "הכל"].includes(location)).map((location) => ({ path: eventSearchHref(location), world: "events" as const, title: `מקומות לאירועים ב${location}`, description: `מקומות לאירועים ב${location}, עם תמונות, מתקנים ופנייה ישירה למקום.` })),
  { path: "/hourly", world: "hourly", title: "חדרים לפי שעה", description: "בוחרים אזור ומחייגים ישירות למקום, בלי להזמין לילה שלם." },
  ...searchLocationOptions("hourly").filter((location) => !["כל הארץ", "הכל"].includes(location)).map((location) => ({ path: hourlySearchHref(location), world: "hourly" as const, title: `חדרים לפי שעה ב${location}`, description: `חדרים וסוויטות לשהייה קצרה ב${location}, עם סינון לפי מחיר ומאפייני המקום.` })),
];

export const searchPageDefinitions = allSearchPageDefinitions.filter((entry, index, all) => all.findIndex((candidate) => candidate.path === entry.path) === index);

export function searchPageDefinition(path: string) { return searchPageDefinitions.find((entry) => entry.path === path); }

export function parseSearchPageInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.path !== "string" || !searchPageDefinition(row.path) || typeof row.title !== "string" || typeof row.description !== "string" ||
    !["draft", "published", "scheduled"].includes(String(row.status)) || !Number.isSafeInteger(row.expectedVersion) || Number(row.expectedVersion) < 0) return null;
  const title = row.title.trim(); const description = row.description.trim();
  if (title.length < 8 || title.length > 90 || description.length < 30 || description.length > 300 || /[<>]/.test(title + description)) return null;
  const scheduledAt = typeof row.scheduledAt === "string" && row.scheduledAt ? new Date(row.scheduledAt) : null;
  if (row.status === "scheduled" && (!scheduledAt || !Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now())) return null;
  return { path: row.path, title, description, status: row.status as SearchPageStatus,
    scheduledAt: scheduledAt?.toISOString() || null, expectedVersion: row.expectedVersion as number };
}

async function db(): Promise<D1Database> {
  const runtime = await import("cloudflare:workers");
  const database = (runtime.env as unknown as { DB?: D1Database }).DB;
  if (!database) throw new Error("search_page_database_unavailable");
  return database;
}

export async function searchPageDatabase() {
  const database = await db();
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS vii_search_page_content (path TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL, scheduled_at TEXT, version INTEGER NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`),
    database.prepare(`CREATE TABLE IF NOT EXISTS vii_search_page_versions (id TEXT PRIMARY KEY NOT NULL, path TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL, scheduled_at TEXT, version INTEGER NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL)`),
    database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_vii_search_page_version ON vii_search_page_versions(path, version)"),
  ]);
  // Earlier releases created these tables without a scheduling column. The
  // guarded upgrade keeps both existing D1 databases and clean installs valid.
  await Promise.all([
    database.prepare("ALTER TABLE vii_search_page_content ADD COLUMN scheduled_at TEXT").run().catch(() => undefined),
    database.prepare("ALTER TABLE vii_search_page_versions ADD COLUMN scheduled_at TEXT").run().catch(() => undefined),
  ]);
  return database;
}

export async function publishedSearchPage(path: string): Promise<SearchPageDefinition | null> {
  const definition = searchPageDefinition(path);
  if (!definition) return null;
  try {
    // The editable row is the latest draft.  Public content must instead be
    // resolved from the latest version eligible at this instant, otherwise a
    // future version would hide an already-published page until its date.
    const row = await (await db()).prepare("SELECT title, description FROM vii_search_page_versions WHERE path = ? AND (status = 'published' OR (status = 'scheduled' AND scheduled_at <= ?)) ORDER BY version DESC LIMIT 1").bind(path, new Date().toISOString()).first<{ title: string; description: string }>();
    return row ? { ...definition, title: row.title, description: row.description } : definition;
  } catch { return definition; }
}

export async function searchPageInventory(database: D1Database) {
  const result = await database.prepare("SELECT path, title, description, status, scheduled_at AS scheduledAt, version, updated_at AS updatedAt, updated_by AS updatedBy FROM vii_search_page_content").all<SearchPageContent>();
  return searchPageDefinitions.map((definition) => ({ ...definition, override: result.results.find((row) => row.path === definition.path) || null }));
}
