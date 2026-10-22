import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { supplierToken } from "../../../lib/vii-supplier-token.ts";

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
  const reference = (url.searchParams.get("reference") || "").trim();
  if (!Number.isSafeInteger(siteID) || siteID < 1 || !/^VII-[A-Za-z0-9-]{8,59}$/.test(reference)) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  }
  if (!(await publishedSupplierIds("vacations")).has(siteID)) {
    return Response.json({ error: "not_published" }, { status: 404, headers });
  }
  try {
    const response = await fetch(`${API_ROOT}/vacations/${siteID}/booking?ref=${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${await supplierToken()}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 404) return Response.json({ found: false, reference }, { status: 404, headers });
    if (!response.ok) return Response.json({ error: "supplier_unavailable", upstreamStatus: response.status }, { status: 503, headers });
    const raw = object(await response.json());
    const summary = object(raw.summary);
    const totals = object(summary.totals);
    return Response.json({
      found: true,
      reference,
      status: raw.status,
      bookingID: Number.isSafeInteger(raw.bookingID) ? raw.bookingID : null,
      systemOrderID: Number.isSafeInteger(raw.systemOrderID) ? raw.systemOrderID : null,
      summary: {
        siteID: summary.siteID,
        from: summary.from,
        till: summary.till,
        nights: summary.nights,
        currency: summary.currency,
        total: Number.isFinite(totals.total) ? totals.total : null,
      },
    }, { headers });
  } catch {
    return Response.json({ error: "supplier_unavailable", upstreamStatus: null }, { status: 503, headers });
  }
}
