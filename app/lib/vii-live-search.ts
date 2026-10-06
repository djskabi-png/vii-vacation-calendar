const API_ROOT = "https://bizonline.co.il/api/ai/vii";

export type LiveSearchWorld = "vacations" | "events";
export type LiveSearchResult = {
  siteID: number;
  available: boolean | null;
  onlineBooking: boolean;
  total: number | null;
  from: string | null;
  till: string | null;
  start: string | null;
  reason: string | null;
};

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function daysBetween(from: string, till: string) {
  return Math.round((Date.parse(`${till}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export async function liveSupplierSearch(options: {
  world: LiveSearchWorld;
  from: string;
  till: string;
  guests: number;
  hours?: number;
  token: string;
  publishedIds: ReadonlySet<number>;
  fetchImpl?: typeof fetch;
}) {
  const { world, from, till, guests, publishedIds } = options;
  const days = daysBetween(from, till);
  if (!validDate(from) || !validDate(till) || !Number.isSafeInteger(guests) || guests < 1 || guests > 1000
    || (world === "vacations" ? days < 1 || days > 30 : days < 0 || days > 62)
    || (world === "events" && (!Number.isSafeInteger(options.hours) || options.hours! < 1 || options.hours! > 24))) {
    throw new Error("invalid_search");
  }
  if (!options.token) throw new Error("supplier_unavailable");
  const bodies: Record<string, unknown>[] = [];
  if (world === "vacations") bodies.push({ from, nights: days, rooms: [{ adults: guests }] });
  else if (days === 0) bodies.push({ date: from, hours: options.hours, rooms: [{ adults: guests }] });
  else {
    let cursor = Date.parse(`${from}T00:00:00Z`);
    const end = Date.parse(`${till}T00:00:00Z`);
    while (cursor <= end) {
      const chunkEnd = Math.min(end, cursor + 30 * 86_400_000);
      bodies.push({ window: { from: new Date(cursor).toISOString().slice(0, 10), till: new Date(chunkEnd).toISOString().slice(0, 10) }, hours: options.hours, rooms: [{ adults: guests }] });
      cursor = chunkEnd + 86_400_000;
    }
  }
  const payloads = await Promise.all(bodies.map(async (body) => {
    const response = await (options.fetchImpl ?? fetch)(`${API_ROOT}/${world}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${options.token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error("supplier_unavailable");
    const payload = object(await response.json());
    if (!Array.isArray(payload.sites)) throw new Error("invalid_supplier_response");
    return payload;
  }));
  const parsed = payloads.map((payload) => (payload.sites as unknown[]).flatMap((value) => {
    const site = object(value);
    const siteID = site.siteID;
    if (!Number.isSafeInteger(siteID) || !publishedIds.has(siteID as number)) return [];
    const cheapest = object(site.cheapest);
    const reportedAvailable = site.available === true ? true : site.available === false ? false : null;
    const total = reportedAvailable && typeof site.minTotal === "number" && Number.isFinite(site.minTotal) && site.minTotal > 0 ? site.minTotal : null;
    const resultFrom = world === "vacations" ? cheapest.from : cheapest.date;
    const resultTill = world === "vacations" ? cheapest.till : cheapest.endDate;
    const validStay = world === "vacations"
      ? resultFrom === from && resultTill === till
      : validDate(resultFrom) && resultFrom >= from && resultFrom <= till && validDate(resultTill)
        && typeof cheapest.start === "string" && /^\d{2}:\d{2}$/.test(cheapest.start);
    const available = reportedAvailable && (!validStay || total === null) ? null : reportedAvailable;
    return [{
      siteID: siteID as number,
      available,
      onlineBooking: site.onlineBooking === true,
      total: available ? total : null,
      from: validDate(resultFrom) ? resultFrom : null,
      till: validDate(resultTill) ? resultTill : null,
      start: typeof cheapest.start === "string" && /^\d{2}:\d{2}$/.test(cheapest.start) ? cheapest.start : null,
      reason: typeof site.reason === "string" ? site.reason : reportedAvailable && !available ? "invalid_supplier_response" : null,
    }];
  }));
  const ids = new Set(parsed.flatMap((items) => items.map((item) => item.siteID)));
  const results: LiveSearchResult[] = [...ids].map((siteID) => {
    const answers = parsed.map((items) => items.find((item) => item.siteID === siteID));
    const available = answers.filter((item): item is LiveSearchResult => item?.available === true);
    if (available.length) return [...available].sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity))[0];
    if (answers.every((item) => item?.available === false)) return answers[0]!;
    const reason = answers.find((item) => item?.reason)?.reason || "unknown";
    return { siteID, available: null, onlineBooking: false, total: null, from: null, till: null, start: null, reason };
  });
  return { checkedAt: typeof payloads[0].created === "string" ? payloads[0].created : null, world, results };
}
