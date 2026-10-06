import catalog from "../../../data/sergey-public-catalog.json";
import { supplierStayQuote } from "../../../lib/vii-stay-quote";
import { supplierToken } from "../../../lib/vii-supplier-token";

const publishedIds = new Set(catalog.places.filter((place) => place.world === "vacations").map((place) => place.supplierId));
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    body = value;
  } catch {
    return Response.json({ error: "invalid_stay" }, { status: 400, headers });
  }
  try {
    const quote = await supplierStayQuote({
      siteID: Number(body.siteID), from: String(body.from || ""), till: String(body.till || ""),
      guests: Number(body.guests), token: await supplierToken(), publishedIds,
    });
    return Response.json(quote, { headers });
  } catch (error) {
    const invalid = error instanceof Error && error.message === "invalid_stay";
    return Response.json({ error: invalid ? "invalid_stay" : "supplier_unavailable" }, { status: invalid ? 400 : 503, headers });
  }
}
