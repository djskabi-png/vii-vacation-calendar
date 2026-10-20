import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { BookingError, createSupplierBooking } from "../../../lib/vii-supplier-booking";
import { supplierToken } from "../../../lib/vii-supplier-token";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { recordBookingAudit } from "../../../lib/operations-audit";
import type { VacationSearchRoom } from "../../../lib/vacation-party";
import { runtimeDatabase } from "../../../lib/runtime-database.ts";

const headers = { "Cache-Control": "no-store" };

async function limitBookingRequests(request: Request) {
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) throw new BookingError("supplier_unavailable", 503);
  const db = await runtimeDatabase();
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
  let attemptedReference = "";
  let attemptedSiteId = "";
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body) || body.privacyAccepted !== true || body.honey) {
      throw new BookingError("invalid_booking", 400);
    }
    const guest = body.guest as Record<string, unknown> | undefined;
    if (!guest || typeof guest !== "object" || Array.isArray(guest)) throw new BookingError("invalid_booking", 400);
    attemptedReference = String(body.partnerRef || "");
    attemptedSiteId = String(body.siteID || "");
    await limitBookingRequests(request);
    const receipt = await createSupplierBooking({
      siteID: Number(body.siteID), roomID: Number(body.roomID), from: String(body.from || ""),
      till: String(body.till || ""), guests: Number(body.guests), expectedTotal: Number(body.expectedTotal),
      partnerRef: String(body.partnerRef || ""),
      party: body.party as VacationSearchRoom | undefined,
      guest: {
        firstName: String(guest.firstName || "").trim(), lastName: String(guest.lastName || "").trim(),
        phone: String(guest.phone || "").trim(), email: String(guest.email || "").trim(),
        remarks: String(guest.remarks || "").trim().slice(0, 1500),
      },
      token: await supplierToken(), publishedIds: await publishedSupplierIds("vacations"),
    });
    try {
      await recordBookingAudit({ id: receipt.reference, world: "vacation", placeId: `vacation-${body.siteID}`,
        placeName: `vacation-${body.siteID}`, destination: "sergey", status: "supplier_accepted",
        supplierId: String(receipt.bookingID ?? receipt.systemOrderID ?? "") });
    } catch (error) { console.error("VII booking audit unavailable after supplier acceptance", error); }
    return Response.json(receipt, { headers });
  } catch (error) {
    const known = error instanceof BookingError ? error : new BookingError("supplier_unavailable", 503);
    if (known.code === "booking_status_unknown") {
      // A timed-out write may already exist upstream; record the reference without retrying it.
      try {
        if (/^VII-[A-Za-z0-9-]{8,59}$/.test(attemptedReference)) await recordBookingAudit({ id: attemptedReference,
          world: "vacation", placeId: `vacation-${attemptedSiteId}`, placeName: `vacation-${attemptedSiteId}`,
          destination: "sergey", status: "status_unknown" });
      } catch (auditError) { console.error("VII uncertain booking audit unavailable", auditError); }
    }
    return Response.json({ error: known.code }, { status: known.httpStatus, headers });
  }
}
