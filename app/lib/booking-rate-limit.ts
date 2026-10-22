import type { D1Database } from "../../types/cloudflare-runtime";
import { runtimeDatabase } from "./runtime-database.ts";
import { BookingError } from "./vii-supplier-booking.ts";
import { supplierToken } from "./vii-supplier-token.ts";

export async function limitBookingRequests(request: Request, dependencies?: { db?: D1Database; token?: string }) {
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) throw new BookingError("supplier_unavailable", 503);
  const db = dependencies?.db ?? await runtimeDatabase();
  if (!db) throw new BookingError("supplier_unavailable", 503);
  const token = dependencies?.token ?? await supplierToken();
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${token}:${ip}`));
  const hashedIp = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const hour = Math.floor(Date.now() / 3_600_000);

  // Schema creation belongs to the deployed database migration. Running DDL
  // in the customer request path breaks Aurora-backed bookings before the
  // supplier is contacted and adds avoidable latency to every submission.
  const result = await db.prepare(`INSERT INTO vii_booking_rate (bucket, attempts, hour) VALUES (?, 1, ?)
    ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1 WHERE attempts < 10`)
    .bind(`${hour}:${hashedIp}`, hour).run();
  if (result.meta.changes !== 1) throw new BookingError("rate_limited", 429);
}
