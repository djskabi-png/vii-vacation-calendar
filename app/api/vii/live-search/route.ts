import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { liveSupplierSearch, validDate, type LiveSearchWorld } from "../../../lib/vii-live-search";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { publicCatalogSelectedSummaries, publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import type { EventDealPlace } from "../../../lib/event-deal-labels";
import { regionalAvailabilityRegion, regionalPublishedIds } from "../../../lib/regional-availability.ts";

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
  const region = regionalAvailabilityRegion(typeof body.region === "string" ? body.region : null);
  if (body.region !== undefined && (!region || world !== "events" || body.includePlaces !== true)) return Response.json({ error: "invalid_region" }, { status: 400, headers: noStore });
  if ((world !== "vacations" && world !== "events") || !validDate(body.from) || !validDate(body.till)) {
    return Response.json({ error: "invalid_search" }, { status: 400, headers: noStore });
  }
  try {
    const [publicIds, token, regionPlaces] = await Promise.all([
      publishedSupplierIds(world), supplierToken(),
      region ? publicCatalogSummaries<{ supplierId: number; location?: string; area?: string }>("events") : Promise.resolve([]),
    ]);
    const eligibleIds = region ? regionalPublishedIds(regionPlaces, publicIds, region.label) : publicIds;
    const result = await liveSupplierSearch({
      world: world as LiveSearchWorld,
      from: body.from,
      till: body.till,
      guests: Number(body.guests),
      rooms: world === "vacations" && Array.isArray(body.rooms) ? body.rooms as Array<{ adults: number; children?: number }> : undefined,
      slot: world === "events" ? body.slot as "morning" | "evening" | undefined : undefined,
      token,
      publishedIds: eligibleIds,
    });
    if (world === "events" && body.includePlaces === true) {
      const ids = result.results.filter((offer) => offer.available === true && offer.total && offer.slot)
        .sort((a, b) => a.total! - b.total!).slice(0, 12).map((offer) => offer.siteID);
      const places = await publicCatalogSelectedSummaries<EventDealPlace>("events", ids);
      // Join only the matching offers. The homepage's five editorial picks must
      // not limit availability, and its initial HTML must not carry all venues.
      return Response.json({ ...result, ...(region ? { region: region.label } : {}), places: places.filter((place) => place.image).map((place) => ({
        slug: place.slug, name: place.name, location: place.location, type: place.type, guests: place.guests,
        image: place.image, images: (place.images || []).slice(0, 10),
        ...(place.area ? { area: place.area } : {}),
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
