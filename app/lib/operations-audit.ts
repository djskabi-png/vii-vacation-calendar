import type { D1Database } from "../../types/cloudflare-runtime";
import { requiredRuntimeDatabase } from "./runtime-database.ts";

export type BookingAudit = {
  id: string;
  world: string;
  placeId: string;
  placeName: string;
  destination: "sergey" | "vii_leads";
  status: "submission_started" | "supplier_pending" | "supplier_accepted" | "supplier_cancelled" | "supplier_rejected" | "lead_service_accepted" | "lead_service_rejected" | "status_unknown";
  supplierId?: string | null;
  arrivalDate?: string | null;
  departureDate?: string | null;
  amount?: number | null;
  currency?: string | null;
};

export async function operationsDatabase(): Promise<D1Database> {
  const db = await requiredRuntimeDatabase("operations_database_unavailable");
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_booking_audit (
      id TEXT PRIMARY KEY NOT NULL, world TEXT NOT NULL, place_id TEXT NOT NULL,
      place_name TEXT NOT NULL, destination TEXT NOT NULL, status TEXT NOT NULL,
      supplier_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_booking_audit_created ON vii_booking_audit(created_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_booking_context (
      id TEXT PRIMARY KEY NOT NULL, arrival_date TEXT, departure_date TEXT,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_booking_context_arrival ON vii_booking_context(arrival_date)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_booking_financials (
      id TEXT PRIMARY KEY NOT NULL, amount REAL, currency TEXT,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS vii_booking_provider_receipts (
      event_id TEXT PRIMARY KEY NOT NULL, booking_id TEXT NOT NULL, status TEXT NOT NULL,
      supplier_id TEXT NOT NULL, amount REAL, currency TEXT, occurred_at TEXT NOT NULL,
      received_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_vii_booking_provider_receipts_booking ON vii_booking_provider_receipts(booking_id, occurred_at)"),
  ]);
  return db;
}

export async function applySpaProviderBookingReceipt(entry: { id: string; eventId: string; occurredAt: string;
  status: "supplier_pending" | "supplier_accepted" | "supplier_cancelled" | "supplier_rejected";
  supplierId: string; amount?: number | null; currency?: string | null }) {
  const db = await operationsDatabase();
  const now = new Date().toISOString();
  const booking = await db.prepare("SELECT id FROM vii_booking_audit WHERE id = ? AND world = 'spa'").bind(entry.id.slice(0, 100)).first<{ id: string }>();
  if (!booking) return "unknown" as const;
  const duplicate = await db.prepare("SELECT event_id AS eventId FROM vii_booking_provider_receipts WHERE event_id = ?")
    .bind(entry.eventId.slice(0, 120)).first<{ eventId: string }>();
  if (duplicate) return "duplicate" as const;
  const bookingId = entry.id.slice(0, 100);
  const eventId = entry.eventId.slice(0, 120);
  const supplierId = entry.supplierId.slice(0, 100);
  const amount = Number.isFinite(entry.amount) ? entry.amount : null;
  const currency = entry.currency?.slice(0, 8).toUpperCase() || null;
  const statements = [
    db.prepare(`INSERT INTO vii_booking_provider_receipts
      (event_id, booking_id, status, supplier_id, amount, currency, occurred_at, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(eventId, bookingId, entry.status, supplierId,
      amount, currency, entry.occurredAt, now),
    db.prepare(`UPDATE vii_booking_audit SET status = ?, supplier_id = ?, updated_at = ?
      WHERE id = ? AND world = 'spa' AND ? = (SELECT event_id FROM vii_booking_provider_receipts
        WHERE booking_id = ? ORDER BY occurred_at DESC, event_id DESC LIMIT 1)`)
      .bind(entry.status, supplierId, now, bookingId, eventId, bookingId),
  ];
  if (amount !== null || currency) statements.push(db.prepare(`INSERT INTO vii_booking_financials (id, amount, currency, updated_at)
    SELECT ?, ?, ?, ? WHERE ? = (SELECT event_id FROM vii_booking_provider_receipts
      WHERE booking_id = ? ORDER BY occurred_at DESC, event_id DESC LIMIT 1)
    ON CONFLICT(id) DO UPDATE SET amount = excluded.amount,
    currency = excluded.currency, updated_at = excluded.updated_at`)
    .bind(bookingId, amount, currency, now, eventId, bookingId));
  let results;
  try { results = await db.batch(statements); }
  catch (error) {
    const racedDuplicate = await db.prepare("SELECT event_id AS eventId FROM vii_booking_provider_receipts WHERE event_id = ?")
      .bind(eventId).first<{ eventId: string }>().catch(() => null);
    if (racedDuplicate) return "duplicate" as const;
    throw error;
  }
  const updated = results[1];
  if (Number(updated.meta?.changes || 0) !== 1) return "stale" as const;
  return "applied" as const;
}

export async function recordBookingAudit(entry: BookingAudit) {
  const db = await operationsDatabase();
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO vii_booking_audit
    (id, world, place_id, place_name, destination, status, supplier_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status = excluded.status, supplier_id = excluded.supplier_id,
      updated_at = excluded.updated_at`)
    .bind(entry.id.slice(0, 100), entry.world.slice(0, 40), entry.placeId.slice(0, 100),
      entry.placeName.slice(0, 160), entry.destination, entry.status,
      entry.supplierId?.slice(0, 100) || null, now, now).run();
  if (entry.arrivalDate || entry.departureDate) {
    await db.prepare(`INSERT INTO vii_booking_context (id, arrival_date, departure_date, updated_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET arrival_date = excluded.arrival_date,
      departure_date = excluded.departure_date, updated_at = excluded.updated_at`)
      .bind(entry.id.slice(0, 100), entry.arrivalDate || null, entry.departureDate || null, now).run();
  }
  if (Number.isFinite(entry.amount) || entry.currency) {
    await db.prepare(`INSERT INTO vii_booking_financials (id, amount, currency, updated_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET amount = excluded.amount,
      currency = excluded.currency, updated_at = excluded.updated_at`)
      .bind(entry.id.slice(0, 100), Number.isFinite(entry.amount) ? entry.amount : null,
        entry.currency?.slice(0, 8).toUpperCase() || null, now).run();
  }
}
