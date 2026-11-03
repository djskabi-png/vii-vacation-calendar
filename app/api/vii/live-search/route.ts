import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { liveSupplierSearch, validDate, type LiveSearchWorld } from "../../../lib/vii-live-search";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { publicCatalogSelectedSummaries, publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import type { EventDealPlace } from "../../../lib/event-deal-labels";
import { regionalAvailabilityRegion, selectRegionalOffers } from "../../../lib/regional-availability.ts";
import { eligibleDealDate } from "../../../lib/deal-clock.ts";
import { cachedDiscovery, readCachedDiscovery } from "../../../lib/discovery-offer-cache.ts";
import { runtimeCatalogDatabase } from "../../../lib/published-supplier-ids.ts";
import { EVENT_DISCOVERY_POLICY, validEventDiscoveryResult } from "../../../lib/warm-event-discovery-cache.ts";
import { canonicalVerifiedSliderItems } from "../../../lib/verified-slider-offers.ts";

const noStore = { "Cache-Control": "no-store" };
type LiveSearchPayload = Awaited<ReturnType<typeof liveSupplierSearch>>;

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
  const candidates = Array.isArray(body.candidates) ? body.candidates.filter((value): value is { from: string; till: string } => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    return validDate(candidate.from) && validDate(candidate.till);
  }) : [];
  if (body.candidates !== undefined && (world !== "vacations" || candidates.length !== body.candidates.length || candidates.length < 1 || candidates.length > 32)) {
    return Response.json({ error: "invalid_search" }, { status: 400, headers: noStore });
  }
  const datedDiscovery = body.discoverySearch === true && body.includePlaces !== true;
  const region = regionalAvailabilityRegion(typeof body.region === "string" ? body.region : null);
  if (body.region !== undefined && (!region || world !== "events" || body.includePlaces !== true)) return Response.json({ error: "invalid_region" }, { status: 400, headers: noStore });
  if ((world !== "vacations" && world !== "events") || !validDate(body.from) || !validDate(body.till)) {
    return Response.json({ error: "invalid_search" }, { status: 400, headers: noStore });
  }
  if (world === "events" && body.includePlaces === true && !eligibleDealDate(body.from, new Date())) {
    return Response.json({ error: "invalid_search" }, { status: 400, headers: noStore });
  }
  try {
    const [publicIds, token, regionPlaces, cacheDb] = await Promise.all([
      publishedSupplierIds(world), supplierToken(),
      region ? publicCatalogSummaries<{ supplierId: number; image?: string; location?: string; area?: string; lat?: number; lng?: number }>("events") : Promise.resolve([]),
      datedDiscovery || world === "events" && body.includePlaces === true ? runtimeCatalogDatabase().catch(() => null) : Promise.resolve(null),
    ]);
    // Discovery requests opt in explicitly. Detail and booking requests remain
    // realtime and must never inherit discovery's last-good fallback.
    const discovery = world === "events" && body.includePlaces === true;
    if (discovery && (!Number.isSafeInteger(body.guests) || Number(body.guests) < 1 || Number(body.guests) > 1000 || body.till !== body.from || body.slot !== undefined && body.slot !== "morning" && body.slot !== "evening")) throw new Error("invalid_search");
    const load = () => liveSupplierSearch({
      world: world as LiveSearchWorld,
      from: body.from as string,
      till: body.till as string,
      guests: Number(body.guests),
      rooms: world === "vacations" && Array.isArray(body.rooms) ? body.rooms as Array<{ adults: number; children?: number }> : undefined,
      candidates: world === "vacations" && candidates.length ? candidates : undefined,
      slot: world === "events" ? body.slot as "morning" | "evening" | undefined : undefined,
      token,
      publishedIds: publicIds,
    });
    const discoveryOptions = {
      key: ["events-discovery", body.from, body.till, Number(body.guests), body.slot ?? "both"] as const,
      db: cacheDb,
      policy: EVENT_DISCOVERY_POLICY,
      validate: validEventDiscoveryResult,
    };
    const cached = discovery ? await readCachedDiscovery<LiveSearchPayload>(discoveryOptions).catch(() => cachedDiscovery<LiveSearchPayload>({
      ...discoveryOptions,
      // Cold or rejected scheduled snapshots get exactly one cache-coordinated
      // recovery. The durable lease and cooldown prevent a visitor stampede;
      // detail and booking checks remain realtime and outside this cache.
      load,
    })) : null;
    const dated = datedDiscovery ? await cachedDiscovery<LiveSearchPayload>({
      key: ["dated-search", world, body.from, body.till, Number(body.guests), world === "vacations" ? body.rooms ?? null : body.slot ?? "both", candidates.length ? candidates : null],
      db: cacheDb,
      load,
      policy: { freshMs: 60_000, staleMs: 30 * 60_000 },
      validate: value => !!value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results),
    }) : null;
    const result = discovery ? cached!.value : dated ? dated.value : await load();
    if (world === "events" && body.includePlaces === true) {
      const liveOffers = result.results.filter(offer => publicIds.has(offer.siteID) && offer.available === true
        && typeof offer.total === "number" && offer.total > 0 && Boolean(offer.slot) && Boolean(offer.from)
        && Number.isSafeInteger(offer.roomID) && Number(offer.roomID) > 0)
        .sort((a, b) => a.total! - b.total! || a.siteID - b.siteID || String(a.slot).localeCompare(String(b.slot)));
      const selected = region ? selectRegionalOffers(liveOffers, regionPlaces.filter(place => publicIds.has(place.supplierId) && place.image), region.label, { placeId: offer => offer.siteID, key: offer => String(offer.siteID), limit: 20 }) : null;
      const selectedOffers = selected?.offers ?? liveOffers.slice(0, 20);
      const offers = canonicalVerifiedSliderItems(selectedOffers, offer => offer.siteID);
      const ids = offers.map(offer => offer.siteID);
      const places = await publicCatalogSelectedSummaries<EventDealPlace>("events", ids);
      const placeById = new Map(places.flatMap((place) => {
        const match = /^event-(\d+)$/.exec(place.slug);
        return match && place.image ? [[Number(match[1]), place] as const] : [];
      }));
      const visibleOffers = offers.filter(offer => placeById.has(offer.siteID));
      const visiblePlaces = visibleOffers.map(offer => placeById.get(offer.siteID)!);
      // Join only the matching offers. The homepage's five editorial picks must
      // not limit availability, and its initial HTML must not carry all venues.
      return Response.json({ ...result, cache: cached!.cache, results: visibleOffers, ...(region ? { region: region.label, expandedRegion: selected!.expanded, regionalOrder: visibleOffers.map(offer => offer.siteID) } : {}), places: visiblePlaces.map((place) => ({
        slug: place.slug, name: place.name, location: place.location, type: place.type, guests: place.guests,
        image: place.image, images: (place.images || []).slice(0, 10),
        ...(place.area ? { area: place.area } : {}),
        ...(place.sourceUrl ? { sourceUrl: place.sourceUrl } : {}),
        ...(place.sourcePropertySlug ? { sourcePropertySlug: place.sourcePropertySlug } : {}),
        ...(place.contact ? { contact: { ...(place.contact.phone ? { phone: place.contact.phone } : {}), ...(place.contact.whatsapp ? { whatsapp: place.contact.whatsapp } : {}) } } : {}),
      })) }, { headers: { ...noStore, "X-VII-Discovery-Cache": cached!.cache.status } });
    }
    return Response.json(dated ? { ...result, cache: dated.cache } : result, { headers: dated ? { ...noStore, "X-VII-Discovery-Cache": dated.cache.status } : noStore });
  } catch (error) {
    const invalid = error instanceof Error && error.message === "invalid_search";
    return Response.json({ error: invalid ? "invalid_search" : "supplier_unavailable" }, { status: invalid ? 400 : 503, headers: noStore });
  }
}
