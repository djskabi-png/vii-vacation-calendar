import { getHomeDeals, homeDealPeriods, type HomeDealPeriod } from "./vii-home-deals.ts";
import { getHomeHolidayDeals } from "./vii-home-holidays.ts";

const API_ROOT = "https://bizonline.co.il/api/ai/vii";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function confirmHomeDeal(options: {
  source: "home-deals" | "home-holidays";
  period: string;
  siteID: number;
  from: string;
  till: string;
  token: string;
  publicSiteIds: ReadonlySet<number>;
  fetchImpl?: typeof fetch;
  now?: Date;
}) {
  const { source, period, siteID, from, till, token, publicSiteIds } = options;
  if (!Number.isSafeInteger(siteID) || !publicSiteIds.has(siteID) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(till)) throw new Error("invalid_stay");
  const common = { token, publicSiteIds, fetchImpl: options.fetchImpl, now: options.now };
  let result;
  if (source === "home-holidays") {
    if (!/^\d+$/.test(period)) throw new Error("invalid_stay");
    result = await getHomeHolidayDeals({ ...common, id: Number(period), from, till });
  } else {
    if (!homeDealPeriods.some((item) => item.id === period)) throw new Error("invalid_stay");
    result = await getHomeDeals({ ...common, period: period as HomeDealPeriod });
    if (result.dates.from !== from || result.dates.till !== till) return { status: "unavailable" as const };
  }
  const deal = result.deals.find((item) => item.siteID === siteID && item.from === from && item.till === till);
  if (!deal) return { status: "unavailable" as const };
  if (!deal.roomID) return { status: "unverified" as const };

  const response = await (options.fetchImpl ?? fetch)(`${API_ROOT}/vacations/${siteID}/vacancy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ siteID, from, nights: deal.nights, rooms: [{ roomID: deal.roomID, adults: 2 }] }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return { status: "unverified" as const };
  const vacancy = record(await response.json());
  if (vacancy.available === false) return { status: "unavailable" as const };
  const summary = record(vacancy.summary);
  const total = record(summary.totals).total;
  if (vacancy.available !== true || summary.siteID !== siteID || summary.from !== from || summary.till !== till || summary.nights !== deal.nights || !Number.isFinite(total) || (total as number) <= 0) return { status: "unverified" as const };
  return { status: "available" as const, total: total as number, onlineBooking: vacancy.onlineBooking === true };
}
