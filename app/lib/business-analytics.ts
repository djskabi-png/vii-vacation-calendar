import type { D1Database } from "../../types/cloudflare-runtime";
import { requiredRuntimeDatabase } from "./runtime-database.ts";

export const businessEventNames = ["impression", "page_view", "phone_reveal", "phone_click", "whatsapp_lead", "whatsapp_handoff", "booking_request"] as const;
export type BusinessEventName = typeof businessEventNames[number];
export type BusinessEvent = { eventId: string; name: BusinessEventName; placeId: string; placeName: string; world: string; pagePath: string; sessionId: string };

export function parseBusinessEvent(value: unknown): BusinessEvent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.eventId !== "string" || typeof row.name !== "string" || !businessEventNames.includes(row.name as BusinessEventName) || typeof row.placeId !== "string" || typeof row.placeName !== "string" || typeof row.world !== "string" || typeof row.pagePath !== "string" || typeof row.sessionId !== "string") return null;
  if (!/^[0-9a-f-]{20,50}$/i.test(row.eventId) || !/^[0-9a-f-]{20,50}$/i.test(row.sessionId) || row.placeId.length > 160 || row.placeName.length > 180 || row.world.length > 30 || row.pagePath.length > 500 || !row.pagePath.startsWith("/")) return null;
  return row as BusinessEvent;
}

export async function businessAnalyticsDatabase(): Promise<D1Database> {
  const db = await requiredRuntimeDatabase("business_analytics_database_unavailable");
  await db.batch([db.prepare("CREATE TABLE IF NOT EXISTS vii_business_events (event_id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, place_id TEXT NOT NULL, place_name TEXT NOT NULL, world TEXT NOT NULL, page_path TEXT NOT NULL, session_id TEXT NOT NULL, internal INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)"), db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_business_events_report ON vii_business_events(created_at, internal, place_id, name)")]); return db;
}

export async function saveBusinessEvent(db: D1Database, event: BusinessEvent, internal: boolean) { await db.prepare("INSERT OR IGNORE INTO vii_business_events (event_id,name,place_id,place_name,world,page_path,session_id,internal,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(event.eventId,event.name,event.placeId,event.placeName,event.world,event.pagePath,event.sessionId,internal ? 1 : 0,new Date().toISOString()).run(); }
