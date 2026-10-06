import { getHomeHolidays } from "../../../lib/vii-home-holidays";
import { supplierToken } from "../../../lib/vii-supplier-token";

export async function GET() {
  try {
    const holidays = await getHomeHolidays({ token: await supplierToken() });
    return Response.json({ holidays }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
