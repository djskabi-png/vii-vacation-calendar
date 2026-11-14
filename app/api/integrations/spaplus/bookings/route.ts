import { applySpaProviderBookingReceipt } from "../../../../lib/operations-audit.ts";

const headers = { "Cache-Control": "no-store" };
const encoder = new TextEncoder();

async function safeSecretEqual(left: string, right: string) {
  if (!left || !right) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const aa = new Uint8Array(a); const bb = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < aa.length; index++) difference |= aa[index] ^ bb[index];
  return difference === 0;
}

export async function POST(request: Request) {
  const secret = process.env.VII_SPAPLUS_BOOKING_WEBHOOK_SECRET?.trim() || "";
  if (secret.length < 32) return Response.json({ error: "integration_not_configured" }, { status: 503, headers });
  if (!await safeSecretEqual(request.headers.get("x-vii-spa-booking-secret") || "", secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
  const occurredAt = typeof body?.occurredAt === "string" ? body.occurredAt.trim() : "";
  const providerBookingId = typeof body?.providerBookingId === "string" ? body.providerBookingId.trim() : "";
  const sourceStatus = typeof body?.status === "string" ? body.status : "";
  const status = ({ pending: "supplier_pending", confirmed: "supplier_accepted", cancelled: "supplier_cancelled", rejected: "supplier_rejected" } as const)[sourceStatus as "pending" | "confirmed" | "cancelled" | "rejected"];
  const amount = body?.amount === null || body?.amount === undefined ? null : Number(body.amount);
  const currency = typeof body?.currency === "string" ? body.currency.trim().toUpperCase() : "ILS";
  if (!/^[A-Za-z0-9-]{8,100}$/.test(reference) || !/^[A-Za-z0-9._-]{8,120}$/.test(eventId)
    || !/^[A-Za-z0-9._-]{1,100}$/.test(providerBookingId) || !status || !Number.isFinite(Date.parse(occurredAt))
    || amount !== null && (!Number.isFinite(amount) || amount < 0) || !/^[A-Z]{3}$/.test(currency)) {
    return Response.json({ error: "invalid_receipt" }, { status: 400, headers });
  }
  const result = await applySpaProviderBookingReceipt({ id: reference, eventId, occurredAt, status, supplierId: providerBookingId, amount, currency });
  if (result === "unknown") return Response.json({ error: "unknown_reference" }, { status: 404, headers });
  return Response.json({ success: true, reference, status, receiptState: result }, { headers });
}
