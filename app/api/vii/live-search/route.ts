import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { liveSupplierSearch, validDate, type LiveSearchWorld } from "../../../lib/vii-live-search";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { publicCatalogSelectedSummaries } from "../../../lib/public-catalog-read.ts";
import type { EventDealPlace } from "../../../lib/event-deal-labels";

const noStore = { "Cache-Control": "no-store" };

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
      rooms: world === "vacations" && Array.isArray(body.rooms) ? body.rooms as Array<{ adults: number; children?: number }> : undefined,
      slot: world === "events" ? body.slot as "morning" | "evening" | undefined : undefined,
      token: await supplierToken(),
      publishedIds: await publishedSupplierIds(world),
    });
    if (world === "events" && body.includePlaces === true) {
      const ids = result.results.filter((offer) => offer.available === true && offer.total && offer.slot)
        .sort((a, b) => a.total! - b.total!).slice(0, 12).map((offer) => offer.siteID);
      const places = await publicCatalogSelectedSummaries<EventDealPlace>("events", ids);
      // Join only the matching offers. The homepage's five editorial picks must
      // not limit availability, and its initial HTML must not carry all venues.
      return Response.json({ ...result, places: places.filter((place) => place.image).map((place) => ({
        slug: place.slug, name: place.name, location: place.location, type: place.type, guests: place.guests,
        image: place.image, images: (place.images || []).slice(0, 10),
        ...(place.sourceUrl ? { sourceUrl: place.sourceUrl } : {}),
        ...(place.sourcePropertySlug ? { sourcePropertySlug: place.sourcePropertySlug } : {}),
      })) }, { headers: noStore });
    }
    return Response.json(result, { headers: noStore });
  } catch (error) {
    const invalid = error instanceof Error && error.message === "invalid_search";
    return Response.json({ error: invalid ? "invalid_search" : "supplier_unavailable" }, { status: invalid ? 400 : 503, headers: noStore });
  }
}
