import type { D1Database } from "../../types/cloudflare-runtime";

export const ADMIN_HIGHLIGHT_IDS = [
  "impressions", "entry_rate", "action_rate", "unique_browsers",
  "phone_to_booking", "whatsapp_to_booking", "actions", "booking_requests",
  "page_views", "phone_reveals", "whatsapp_leads", "searches",
  "zero_result_rate", "unique_search_sessions", "total_bookings", "total_reviews",
  "zero_results", "pending_pages", "published_pages", "total_whatsapp_leads",
  "catalog_vacations", "catalog_events", "catalog_rooms", "catalog_spa",
] as const;

export type AdminHighlightId = typeof ADMIN_HIGHLIGHT_IDS[number];

export const DEFAULT_ACTIVE_HIGHLIGHTS: AdminHighlightId[] = ADMIN_HIGHLIGHT_IDS.slice(0, 16) as AdminHighlightId[];

export type AdminHighlightPreferences = { order: AdminHighlightId[]; expanded: boolean; updatedAt: string | null };

const schema = `CREATE TABLE IF NOT EXISTS vii_admin_highlight_preferences_v1 (
  email TEXT PRIMARY KEY NOT NULL, order_json TEXT NOT NULL, expanded INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
)`;

function normalizeOrder(value: unknown): AdminHighlightId[] {
  const allowed = new Set<string>(ADMIN_HIGHLIGHT_IDS);
  const selected = Array.isArray(value) ? value.filter((id): id is AdminHighlightId => typeof id === "string" && allowed.has(id)) : [];
  const unique = [...new Set(selected)].slice(0, 16);
  return unique.length ? unique : [...DEFAULT_ACTIVE_HIGHLIGHTS];
}

export async function ensureAdminHighlightPreferences(db: D1Database) {
  await db.prepare(schema).run();
}

export async function readAdminHighlightPreferences(db: D1Database, email: string): Promise<AdminHighlightPreferences> {
  await ensureAdminHighlightPreferences(db);
  const row = await db.prepare(`SELECT order_json AS orderJson, expanded, updated_at AS updatedAt
    FROM vii_admin_highlight_preferences_v1 WHERE email = ?`).bind(email.trim().toLowerCase()).first<{ orderJson: string; expanded: number; updatedAt: string }>();
  let parsed: unknown = null;
  try { parsed = row ? JSON.parse(row.orderJson) : null; } catch { parsed = null; }
  return { order: normalizeOrder(parsed), expanded: row?.expanded === 1, updatedAt: row?.updatedAt || null };
}

export async function saveAdminHighlightPreferences(db: D1Database, email: string, input: { order: unknown; expanded: unknown }) {
  await ensureAdminHighlightPreferences(db);
  const order = normalizeOrder(input.order);
  const expanded = input.expanded === true;
  const updatedAt = new Date().toISOString();
  await db.prepare(`INSERT INTO vii_admin_highlight_preferences_v1(email,order_json,expanded,updated_at)
    VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET order_json=excluded.order_json,
    expanded=excluded.expanded,updated_at=excluded.updated_at`)
    .bind(email.trim().toLowerCase(), JSON.stringify(order), expanded ? 1 : 0, updatedAt).run();
  return { order, expanded, updatedAt } satisfies AdminHighlightPreferences;
}
