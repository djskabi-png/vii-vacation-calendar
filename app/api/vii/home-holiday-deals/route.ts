import { getHomeHolidayDeals } from "../../../lib/vii-home-holidays";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { curateHomeDeals } from "../../../lib/home-deal-curation.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { holidayParts, type HolidayPart } from "../../../lib/holiday-deal-selection.ts";
import { cachedHolidayDiscovery, HOLIDAY_DISCOVERY_POLICY } from "../../../lib/warm-holiday-discovery-cache.ts";
import { runtimeCatalogDatabase } from "../../../lib/published-supplier-ids.ts";
import { discoveryVacationCatalog, type DiscoveryVacationPlace } from "../../../lib/discovery-vacation-catalog.ts";
import { getDiscoveryHolidays } from "../../../lib/discovery-holidays.ts";
import { eligibleDealDate, firstDealDate } from "../../../lib/deal-clock.ts";
import { validDate } from "../../../lib/vii-live-search.ts";
import { prioritizeOnlineFirst, isHomeDealOnlineEligible } from "../../../lib/vacation-online-first.ts";
import { compareVacationPriority } from "../../../lib/vacation-priority.ts";
import { runtimeDatabase } from "../../../lib/runtime-database.ts";
import { getRequestExecutionContext } from "vinext/shims/request-context";
import { publicDiscoveryCatalogIndex } from "../../../lib/discovery-public-index.ts";
import { requestStageTiming } from "../../../lib/request-stage-timing.ts";

const headers = { "Cache-Control": "no-store" };
const publicDiscovery = { "Cache-Control": "no-store" };

async function applyCuration(deals: Awaited<ReturnType<typeof getHomeHolidayDeals>>["deals"]) {
  try {
    const db = await runtimeDatabase();
    return db ? await curateHomeDeals(db, deals, "holidays") : deals;
  } catch { return deals; }
}

export async function GET(request: Request) {
  const timing = requestStageTiming();
  const respond = (body: unknown, init: ResponseInit = {}) => {
    const responseHeaders = new Headers(init.headers);
    responseHeaders.set("Server-Timing", timing.header());
    return Response.json(body, { ...init, headers: responseHeaders });
  };
  const params = new URL(request.url).searchParams;
  const raw = params.get("id");
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "invalid_holiday" }, { status: 400, headers });
  const guests = params.has("guests") ? Number(params.get("guests")) : 2;
  const part = params.get("part") ?? "all";
  if (![2, 6, 20].includes(guests) || !holidayParts.includes(part as HolidayPart)) return Response.json({ error: "invalid_selection" }, { status: 400, headers });
  if ((params.has("from") || params.has("till")) && (!validDate(params.get("from")) || !validDate(params.get("till")) || part !== "all")) return Response.json({ error: "invalid_stay" }, { status: 400, headers });
  try {
    const databasePromise = timing.measure("database", () => runtimeCatalogDatabase());
    const [db, index, token] = await Promise.all([
      databasePromise,
      databasePromise.then(db => timing.measure("catalog_index", () => publicDiscoveryCatalogIndex("vacations", db))),
      timing.measure("token", () => supplierToken()),
    ]);
    const { places: names, publishedIds: publicSiteIds } = index;
    const now = new Date();
    const holidays = await timing.measure("calendar", () => getDiscoveryHolidays(token, now));
    const holiday = holidays.find(item => item.id === id);
    if (!holiday) throw new Error("invalid_holiday");
    if (params.has("from") && (params.get("from")! < holiday.from || params.get("till")! > holiday.till || Date.parse(params.get("till")!) - Date.parse(params.get("from")!) !== holiday.nights * 86_400_000)) throw new Error("invalid_stay");
    // Cache hits only require publication identities. Gallery/room enrichment
    // belongs to the lease-owned refresh, never to every visitor's cache read.
    const resolveCatalog = async (ids: number[]) => discoveryVacationCatalog(await publicCatalogSummaries<DiscoveryVacationPlace>("vacations"))(ids);
    const refresh = cachedHolidayDiscovery({ id, from: holiday.from, till: holiday.till, requestedFrom: params.get("from") ?? undefined, requestedTill: params.get("till") ?? undefined, guests, part: part as HolidayPart, now, db,
      load: () => getHomeHolidayDeals({ id, token, holidays, now, publicSiteIds, publicNames: new Map(names.map((place) => [place.supplierId, place.name])), resolveCatalog, from: params.get("from") ?? undefined, till: params.get("till") ?? undefined, guests, part: part as HolidayPart }),
      validate: value => !!value && typeof value === "object" && Array.isArray((value as { deals?: unknown }).deals),
    }).catch(() => null);
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 1200));
    const cached = await timing.measure("snapshot", () => Promise.race([refresh, timeout]));
    if (!cached) {
      getRequestExecutionContext()?.waitUntil(refresh.then(() => undefined));
      return respond({ holiday, dates: { from: holiday.from, till: holiday.till, nights: holiday.nights }, deals: [],
        availabilityStatus: "refreshing" },
      { headers: { ...headers, "X-VII-Discovery-Cache": "refreshing" } });
    }
    const result = cached.value;
    const deals = prioritizeOnlineFirst((await applyCuration(result.deals)).filter(deal => publicSiteIds.has(deal.siteID) && deal.priceGuests === guests && eligibleDealDate(deal.from, now)), deal => isHomeDealOnlineEligible(deal), (a, b) => compareVacationPriority(a, b, a.siteID, b.siteID, `holiday:${id}:${part}`));
    return respond({ ...result, deals, cache: cached.cache, availabilityStatus: "verified" }, { headers: { ...publicDiscovery, "X-VII-Discovery-Cache": cached.cache.status } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "supplier_unavailable";
    return respond({ error: reason }, { status: reason === "invalid_holiday" ? 404 : ["invalid_stay", "invalid_selection"].includes(reason) ? 400 : 503, headers });
  }
}
