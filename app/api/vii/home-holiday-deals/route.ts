import { getHomeHolidayDeals } from "../../../lib/vii-home-holidays";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { curateHomeDeals } from "../../../lib/home-deal-curation.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { holidayForRequestedStay, holidayParts, type HolidayPart } from "../../../lib/holiday-deal-selection.ts";
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
import { verifiedPublicDiscoveryHeaders } from "../../../lib/public-discovery-response.ts";

const headers = { "Cache-Control": "no-store" };
// A missing durable snapshot must be completed inside this request. The
// production runtime did not reliably preserve the leased refresh after a
// 350ms `refreshing` response, so every browser poll could observe the same
// cold state again. Warm and stale keys still return immediately; this bound
// is used only for the first snapshot fill and stays below the client budget.
const visitorWarmBudgetMs = 6_500;

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
  const requestedId = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
  const matchFrom = params.get("matchFrom");
  const matchTill = params.get("matchTill");
  const validRequestedId = Number.isSafeInteger(requestedId) && requestedId > 0;
  const validHolidayMatch = validDate(matchFrom) && validDate(matchTill);
  if (!validRequestedId && !validHolidayMatch) return Response.json({ error: "invalid_holiday" }, { status: 400, headers });
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
    // A direct dated search resolves the holiday and its discovery snapshot in
    // one no-store request. This prevents a stale calendar response from
    // briefly starting an ordinary one-night search before the holiday plan.
    const holiday = validRequestedId
      ? holidays.find(item => item.id === requestedId)
      : holidayForRequestedStay(holidays, { from: matchFrom!, till: matchTill! });
    if (!holiday) throw new Error("invalid_holiday");
    const id = holiday.id;
    if (params.has("from") && (params.get("from")! < holiday.from || params.get("till")! > holiday.till || Date.parse(params.get("till")!) - Date.parse(params.get("from")!) !== holiday.nights * 86_400_000)) throw new Error("invalid_stay");
    // Cache hits only require publication identities. Gallery/room enrichment
    // belongs to the lease-owned refresh, never to every visitor's cache read.
    const resolveCatalog = async (ids: number[]) => discoveryVacationCatalog(await publicCatalogSummaries<DiscoveryVacationPlace>("vacations"))(ids);
    const refresh = cachedHolidayDiscovery({ id, from: holiday.from, till: holiday.till, requestedFrom: params.get("from") ?? undefined, requestedTill: params.get("till") ?? undefined, guests, part: part as HolidayPart, now, db,
      load: () => getHomeHolidayDeals({ id, token, holidays, now, publicSiteIds, publicNames: new Map(names.map((place) => [place.supplierId, place.name])), resolveCatalog, from: params.get("from") ?? undefined, till: params.get("till") ?? undefined, guests, part: part as HolidayPart }),
      validate: value => !!value && typeof value === "object" && Array.isArray((value as { deals?: unknown }).deals),
    }).catch(() => null);
    // Prefer one bounded response over a partial response followed by the
    // same browser request. cachedHolidayDiscovery retains the single D1
    // lease, so concurrent visitors still share one supplier operation.
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), visitorWarmBudgetMs));
    const cached = await timing.measure("snapshot", () => Promise.race([refresh, timeout]));
    if (!cached) {
      getRequestExecutionContext()?.waitUntil(refresh.then(() => undefined));
      return respond({ holiday, dates: { from: holiday.from, till: holiday.till, nights: holiday.nights }, deals: [],
        availabilityStatus: "refreshing" },
      { headers: { ...headers, "X-VII-Discovery-Cache": "refreshing" } });
    }
    const result = cached.value;
    const deals = prioritizeOnlineFirst((await applyCuration(result.deals)).filter(deal => publicSiteIds.has(deal.siteID) && deal.priceGuests === guests && eligibleDealDate(deal.from, now)), deal => isHomeDealOnlineEligible(deal), (a, b) => compareVacationPriority(a, b, a.siteID, b.siteID, `holiday:${id}:${part}`));
    return respond({ ...result, deals, cache: cached.cache, availabilityStatus: "verified" }, { headers: { ...verifiedPublicDiscoveryHeaders(request, now), "X-VII-Discovery-Cache": cached.cache.status } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "supplier_unavailable";
    // Date matching is a discovery probe, not a request for a known holiday.
    // A valid date range that does not belong to a managed holiday is a
    // successful negative match. Returning 404 here polluted every ordinary
    // dated search with a console/network error before its normal availability
    // request even started.
    if (reason === "invalid_holiday" && validHolidayMatch && !validRequestedId) {
      return respond({ matched: false, deals: [], availabilityStatus: "not_applicable" }, { headers });
    }
    return respond({ error: reason }, { status: reason === "invalid_holiday" ? 404 : ["invalid_stay", "invalid_selection"].includes(reason) ? 400 : 503, headers });
  }
}
