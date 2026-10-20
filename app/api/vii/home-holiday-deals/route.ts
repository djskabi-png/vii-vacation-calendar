import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { getHomeHolidayDeals } from "../../../lib/vii-home-holidays";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { curateHomeDeals } from "../../../lib/home-deal-curation.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { holidayParts, type HolidayPart } from "../../../lib/holiday-deal-selection.ts";
import { cachedDiscovery } from "../../../lib/discovery-offer-cache.ts";
import { runtimeCatalogDatabase } from "../../../lib/published-supplier-ids.ts";
import { discoveryVacationCatalog, type DiscoveryVacationPlace } from "../../../lib/discovery-vacation-catalog.ts";
import { getDiscoveryHolidays } from "../../../lib/discovery-holidays.ts";
import { eligibleDealDate, firstDealDate } from "../../../lib/deal-clock.ts";
import { validDate } from "../../../lib/vii-live-search.ts";
import { prioritizeOnlineFirst, isHomeDealOnlineEligible } from "../../../lib/vacation-online-first.ts";
import { compareVacationPriority } from "../../../lib/vacation-priority.ts";
import { runtimeDatabase } from "../../../lib/runtime-database.ts";

const headers = { "Cache-Control": "no-store" };

async function applyCuration(deals: Awaited<ReturnType<typeof getHomeHolidayDeals>>["deals"]) {
  try {
    const db = await runtimeDatabase();
    return db ? await curateHomeDeals(db, deals, "holidays") : deals;
  } catch { return deals; }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const raw = params.get("id");
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "invalid_holiday" }, { status: 400, headers });
  const guests = params.has("guests") ? Number(params.get("guests")) : 2;
  const part = params.get("part") ?? "all";
  if (![2, 6, 20].includes(guests) || !holidayParts.includes(part as HolidayPart)) return Response.json({ error: "invalid_selection" }, { status: 400, headers });
  if ((params.has("from") || params.has("till")) && (!validDate(params.get("from")) || !validDate(params.get("till")) || part !== "all")) return Response.json({ error: "invalid_stay" }, { status: 400, headers });
  try {
    const [names, publicSiteIds, token] = await Promise.all([
      publicCatalogSummaries<DiscoveryVacationPlace>("vacations"),
      publishedSupplierIds("vacations"), supplierToken(),
    ]);
    const now = new Date();
    const holidays = await getDiscoveryHolidays(token, now);
    const holiday = holidays.find(item => item.id === id);
    if (!holiday) throw new Error("invalid_holiday");
    if (params.has("from") && (params.get("from")! < holiday.from || params.get("till")! > holiday.till || Date.parse(params.get("till")!) - Date.parse(params.get("from")!) !== holiday.nights * 86_400_000)) throw new Error("invalid_stay");
    const cached = await cachedDiscovery({ key: ["vacation-holiday", id, holiday.from, holiday.till, firstDealDate(now), guests, part, params.get("from"), params.get("till")], db: await runtimeCatalogDatabase(),
      load: () => getHomeHolidayDeals({ id, token, holidays, now, publicSiteIds, publicNames: new Map(names.map((place) => [place.supplierId, place.name])), resolveCatalog: discoveryVacationCatalog(names), from: params.get("from") ?? undefined, till: params.get("till") ?? undefined, guests, part: part as HolidayPart }),
      validate: value => !!value && typeof value === "object" && Array.isArray((value as { deals?: unknown }).deals),
    });
    const result = cached.value;
    const deals = prioritizeOnlineFirst((await applyCuration(result.deals)).filter(deal => publicSiteIds.has(deal.siteID) && deal.priceGuests === guests && eligibleDealDate(deal.from, now)), deal => isHomeDealOnlineEligible(deal), (a, b) => compareVacationPriority(a, b, a.siteID, b.siteID, `holiday:${id}:${part}`));
    return Response.json({ ...result, deals, cache: cached.cache }, { headers: { ...headers, "X-VII-Discovery-Cache": cached.cache.status } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "supplier_unavailable";
    return Response.json({ error: reason }, { status: reason === "invalid_holiday" ? 404 : ["invalid_stay", "invalid_selection"].includes(reason) ? 400 : 503, headers });
  }
}
