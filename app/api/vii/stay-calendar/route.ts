import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { enrichStayCalendarPrices, supplierStayCalendar } from "../../../lib/vii-stay-calendar.ts";
import { supplierToken } from "../../../lib/vii-supplier-token";

const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => !["siteID", "from", "till", "guests"].includes(key) || params.getAll(key).length !== 1)) return Response.json({ error: "invalid_calendar" }, { status: 400, headers });
  try {
    const guests = Number(params.get("guests") || 2);
    if (!Number.isSafeInteger(guests) || guests < 1 || guests > 50) return Response.json({ error: "invalid_calendar" }, { status: 400, headers });
    const token = await supplierToken();
    const calendar = await supplierStayCalendar({ siteID: Number(params.get("siteID")), from: params.get("from") || "", till: params.get("till") || "", token, publishedIds: await publishedSupplierIds("vacations") });
    return Response.json(await enrichStayCalendarPrices({ calendar, guests, token }), { headers });
  } catch (error) {
    const invalid = error instanceof Error && error.message === "invalid_calendar";
    return Response.json({ error: invalid ? "invalid_calendar" : "supplier_unavailable" }, { status: invalid ? 400 : 503, headers });
  }
}
