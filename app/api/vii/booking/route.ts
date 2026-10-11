import catalog from "../../../data/sergey-public-catalog.json";
import { BookingError, createSupplierBooking } from "../../../lib/vii-supplier-booking";
import { supplierToken } from "../../../lib/vii-supplier-token";
import type { D1Database } from "../../../../types/cloudflare-runtime";

const publishedIds = new Set(catalog.places.filter((place) => place.world === "vacations").map((place) => place.supplierId));
const headers = { "Cache-Control": "no-store" };

async function limitBookingRequests(request: Request) {
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) throw new BookingError("supplier_unavailable", 503);
  const runtime = await import("cloudflare:workers");
  const db = (runtime.env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new BookingError("supplier_unavailable", 503);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${await supplierToken()}:${ip}`));
  const hashedIp = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const hour = Math.floor(Date.now() / 3_600_000);
  await db.prepare("CREATE TABLE IF NOT EXISTS vii_booking_rate (bucket TEXT PRIMARY KEY NOT NULL, attempts INTEGER NOT NULL, hour INTEGER NOT NULL)").run();
  const result = await db.prepare(`INSERT INTO vii_booking_rate (bucket, attempts, hour) VALUES (?, 1, ?)
    ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1 WHERE attempts < 10`)
    .bind(`${hour}:${hashedIp}`, hour).run();
  if (result.meta.changes !== 1) throw new BookingError("rate_limited", 429);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body) || body.privacyAccepted !== true || body.honey) {
      throw new BookingError("invalid_booking", 400);
    }
    const guest = body.guest as Record<string, unknown> | undefined;
    if (!guest || typeof guest !== "object" || Array.isArray(guest)) throw new BookingError("invalid_booking", 400);
    await limitBookingRequests(request);
    const receipt = await createSupplierBooking({
      siteID: Number(body.siteID), roomID: Number(body.roomID), from: String(body.from || ""),
      till: String(body.till || ""), guests: Number(body.guests), expectedTotal: Number(body.expectedTotal),
      partnerRef: String(body.partnerRef || ""),
      guest: {
        firstName: String(guest.firstName || "").trim(), lastName: String(guest.lastName || "").trim(),
        phone: String(guest.phone || "").trim(), email: String(guest.email || "").trim(),
        remarks: String(guest.remarks || "").trim().slice(0, 1500),
      },
      token: await supplierToken(), publishedIds,
    });
    return Response.json(receipt, { headers });
  } catch (error) {
    const known = error instanceof BookingError ? error : new BookingError("supplier_unavailable", 503);
    return Response.json({ error: known.code }, { status: known.httpStatus, headers });
  }
}
