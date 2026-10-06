import catalog from "../../../data/sergey-public-catalog.json";
import { liveSupplierSearch, validDate, type LiveSearchWorld } from "../../../lib/vii-live-search";
import { supplierToken } from "../../../lib/vii-supplier-token";

const noStore = { "Cache-Control": "no-store" };
const published = {
  vacations: new Set(catalog.places.filter((place) => place.world === "vacations").map((place) => place.supplierId)),
  events: new Set(catalog.places.filter((place) => place.world === "events").map((place) => place.supplierId)),
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    body = value;
  } catch {
    return Response.json({ error: "invalid_search" }, { status: 400, headers: noStore });
  }
  const world = body.world;
  if ((world !== "vacations" && world !== "events") || !validDate(body.from) || !validDate(body.till)) {
    return Response.json({ error: "invalid_search" }, { status: 400, headers: noStore });
  }
  try {
    const result = await liveSupplierSearch({
      world: world as LiveSearchWorld,
      from: body.from,
      till: body.till,
      guests: Number(body.guests),
      hours: world === "events" ? Number(body.hours) : undefined,
      token: await supplierToken(),
      publishedIds: published[world],
    });
    return Response.json(result, { headers: noStore });
  } catch (error) {
    const invalid = error instanceof Error && error.message === "invalid_search";
    return Response.json({ error: invalid ? "invalid_search" : "supplier_unavailable" }, { status: invalid ? 400 : 503, headers: noStore });
  }
}
