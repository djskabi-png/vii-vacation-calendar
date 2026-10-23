import type { D1Database } from "../../types/cloudflare-runtime";
import { requiredRuntimeDatabase } from "./runtime-database.ts";

type LeadPayload = Record<string, unknown>;

async function database(): Promise<D1Database> {
  return requiredRuntimeDatabase("VII lead database is unavailable");
}

export async function whatsappLeadDatabase() {
  const db = await database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS whatsapp_leads (
      submission_id TEXT PRIMARY KEY NOT NULL,
      reference TEXT NOT NULL,
      world TEXT NOT NULL,
      place_id TEXT NOT NULL,
      place_name TEXT NOT NULL,
      visitor_name TEXT NOT NULL,
      visitor_phone TEXT NOT NULL,
      requested_date TEXT NOT NULL,
      requested_till TEXT,
      guests TEXT,
      service_name TEXT,
      source_page TEXT,
      handoff_started_at TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_whatsapp_leads_created ON whatsapp_leads(created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_whatsapp_leads_place ON whatsapp_leads(world, place_id, created_at)"),
  ]);
  try { await db.prepare("ALTER TABLE whatsapp_leads ADD COLUMN handoff_started_at TEXT").run(); } catch { /* Existing production table already has the column. */ }
  return db;
}

export async function saveWhatsAppLead(payload: LeadPayload, reference: string) {
  const db = await whatsappLeadDatabase();
  await db.prepare(`INSERT OR IGNORE INTO whatsapp_leads
    (submission_id, reference, world, place_id, place_name, visitor_name, visitor_phone,
      requested_date, requested_till, guests, service_name, source_page, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      String(payload.submissionId).slice(0, 100), reference.slice(0, 100),
      String(payload.world || "").slice(0, 40), String(payload.placeId).slice(0, 100),
      String(payload.placeName).slice(0, 160), String(payload.name).slice(0, 120),
      String(payload.phone).slice(0, 30), String(payload.requestedDate),
      payload.requestedTill ? String(payload.requestedTill) : null,
      payload.guests ? String(payload.guests).slice(0, 20) : null,
      payload.serviceName ? String(payload.serviceName).slice(0, 160) : null,
      payload.sourcePage ? String(payload.sourcePage).slice(0, 500) : null,
      new Date().toISOString(),
    ).run();
}

export async function markWhatsAppHandoff(submissionId: string, reference: string) {
  const db = await whatsappLeadDatabase();
  const result = await db.prepare(`UPDATE whatsapp_leads SET handoff_started_at = ?
    WHERE submission_id = ? AND reference = ? AND handoff_started_at IS NULL`)
    .bind(new Date().toISOString(), submissionId.slice(0, 100), reference.slice(0, 100)).run();
  return Number(result.meta?.changes || 0) > 0;
}
