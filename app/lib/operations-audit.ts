import type { D1Database } from "../../types/cloudflare-runtime";
import { requiredRuntimeDatabase } from "./runtime-database.ts";

export type BookingAudit = {
  id: string;
  world: string;
  placeId: string;
  placeName: string;
  destination: "sergey" | "vii_leads";
  status: "supplier_accepted" | "lead_service_accepted" | "status_unknown";
  supplierId?: string | null;
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
  ]);
  return db;
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
}
