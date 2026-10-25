import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { supplierStayQuote } from "../../../lib/vii-stay-quote";
import { supplierToken } from "../../../lib/vii-supplier-token";
import type { VacationSearchRoom } from "../../../lib/vacation-party";
import { supplierStayUnitQuotes } from "../../../lib/vii-unit-quotes";

const headers = { "Cache-Control": "no-store" };

function roomIds(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 24) throw new Error("invalid_stay");
  const ids = [...new Set(value.map(Number))];
  if (ids.length !== value.length || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) throw new Error("invalid_stay");
  return ids;
}

function combinedParty(value: unknown, guests: number): VacationSearchRoom[] {
  if (!Array.isArray(value) || !value.length) return [{ adults: guests }];
  const rows = value as VacationSearchRoom[];
  return [{
    adults: rows.reduce((sum, room) => sum + Number(room.adults || 0), 0),
    ...(rows.some((room) => room.children) ? { children: rows.reduce((sum, room) => sum + Number(room.children || 0), 0) } : {}),
    ...(rows.some((room) => room.infants) ? { infants: rows.reduce((sum, room) => sum + Number(room.infants || 0), 0) } : {}),
  }];
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_stay");
    body = value as Record<string, unknown>;
    const siteID = Number(body.siteID);
    const guests = Number(body.guests);
    const ids = roomIds(body.roomIDs);
    const rooms = combinedParty(body.rooms, guests);
    const token = await supplierToken();
    const publishedIds = await publishedSupplierIds("vacations");
    const units = await supplierStayUnitQuotes({ roomIDs: ids, concurrency: 4, quote: (roomID) => supplierStayQuote({
      siteID, from: String(body.from || ""), till: String(body.till || ""), guests,
      rooms, roomID, token, publishedIds,
    }) });
    return Response.json({ units }, { headers });
  } catch (error) {
    const invalid = error instanceof Error && error.message === "invalid_stay";
    return Response.json({ error: invalid ? "invalid_stay" : "supplier_unavailable" }, { status: invalid ? 400 : 503, headers });
  }
}
