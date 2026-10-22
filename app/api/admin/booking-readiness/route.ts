import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { supplierToken } from "../../../lib/vii-supplier-token.ts";
import { daysBetween, validDate } from "../../../lib/vii-live-search.ts";

const API_ROOT = "https://bizonline.co.il/api/ai/vii";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET(request: Request) {
  if (!await authorizedAdminSession(request).catch(() => null)) {
    return Response.json({ error: "forbidden" }, { status: 403, headers });
  }
  const url = new URL(request.url);
  const siteID = Number(url.searchParams.get("siteID"));
  const from = url.searchParams.get("from") || "";
  const till = url.searchParams.get("till") || "";
  const adults = Number(url.searchParams.get("adults") || 2);
  const nights = validDate(from) && validDate(till) ? daysBetween(from, till) : 0;
  if (!Number.isSafeInteger(siteID) || siteID < 1 || !validDate(from) || !validDate(till)
    || nights < 1 || nights > 30 || !Number.isSafeInteger(adults) || adults < 1 || adults > 30) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  }
  if (!(await publishedSupplierIds("vacations")).has(siteID)) {
    return Response.json({ error: "not_published" }, { status: 404, headers });
  }
  const auth = { Authorization: `Bearer ${await supplierToken()}`, Accept: "application/json", "Content-Type": "application/json" };
  try {
    const searchResponse = await fetch(`${API_ROOT}/vacations/search`, {
      method: "POST", headers: auth, body: JSON.stringify({ siteID, from, nights, rooms: [{ adults }] }),
      cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    if (!searchResponse.ok) return Response.json({ error: "supplier_unavailable" }, { status: 503, headers });
    const sites = object(await searchResponse.json()).sites;
    const site = Array.isArray(sites) ? sites.map(object).find((candidate) => candidate.siteID === siteID) : null;
    const cheapest = object(site?.cheapest);
    const rooms = Array.isArray(cheapest.rooms) ? cheapest.rooms.map(object) : [];
    if (!site || site.available !== true || cheapest.from !== from || cheapest.till !== till || rooms.length !== 1
      || !Number.isSafeInteger(rooms[0].roomID) || Number(rooms[0].roomID) < 1) {
      return Response.json({ ready: false, reason: typeof site?.reason === "string" ? site.reason : "not_available" }, { headers });
    }
    const roomID = Number(rooms[0].roomID);
    const vacancyResponse = await fetch(`${API_ROOT}/vacations/${siteID}/vacancy`, {
      method: "POST", headers: auth,
      body: JSON.stringify({ siteID, from, nights, rooms: [{ roomID, adults }] }),
      cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    if (!vacancyResponse.ok) return Response.json({ error: "supplier_unavailable" }, { status: 503, headers });
    const vacancy = object(await vacancyResponse.json());
    const summary = object(vacancy.summary);
    const totals = object(summary.totals);
    if (vacancy.available !== true || vacancy.onlineBooking !== true || summary.siteID !== siteID
      || summary.from !== from || summary.till !== till || summary.nights !== nights
      || summary.currency !== "ILS" || !Number.isFinite(totals.total) || Number(totals.total) <= 0) {
      return Response.json({ ready: false, reason: typeof vacancy.reason === "string" ? vacancy.reason : "not_bookable" }, { headers });
    }
    return Response.json({ ready: true, siteID, roomID, from, till, nights, adults, total: Number(totals.total), currency: "ILS" }, { headers });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers });
  }
}
