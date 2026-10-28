import placeDetails from "../../data/sergey-place-details.json" with { type: "json" };
import { legacyAvailabilitySourceFor } from "../../lib/legacy-availability-sources";
import { recommendVacationUnits } from "../../lib/vacation-party-recommendation.mjs";
import { assessCalendarStay, supplierStayCalendar } from "../../lib/vii-stay-calendar";
import { supplierToken } from "../../lib/vii-supplier-token";

const BIZ_API_ROOT = "https://bizonline.co.il/api/ai/vii";

type SourceRoom = { id: number; quantity: number; guests: number };
type LegacyQuote = {
  success: true;
  place: string;
  from: string;
  till: string;
  availability: "available" | "unavailable";
  availableUnits: number;
  totalUnits: number;
  totalPrice: number;
  nightlyPrice: number;
  includedGuests: number;
  units: Array<{
    index: number;
    availability: "available" | "unavailable";
    availableCount: number;
    totalPrice: number;
    nightlyPrice: number;
    maxGuests: number;
  }>;
  recommendation: {
    guests: number;
    unitCount: number;
    totalCapacity: number;
    totalPrice?: number;
    nightlyPrice?: number;
    items: Array<{
      index: number;
      quantity: number;
      maxGuests: number;
      totalPrice?: number;
      nightlyPrice?: number;
    }>;
  } | null;
  source: string;
  checkedAt: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "X-VII-Availability-Source": "biz-calendar-v1.1",
    },
  });
}

function validDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function nightsBetween(from: string, till: string) {
  const arrival = Date.parse(`${from}T12:00:00Z`);
  const departure = Date.parse(`${till}T12:00:00Z`);
  return Math.round((departure - arrival) / 86_400_000);
}

function sourceRooms(siteId: number): SourceRoom[] {
  const details = (placeDetails.details as Record<string, { rooms?: Array<Record<string, unknown>> }>)[`vacation-${siteId}`];
  return (details?.rooms ?? []).flatMap((room): SourceRoom[] => {
    const id = Number(room.id);
    const quantity = Number(room.quantity);
    const guests = Number(room.guests);
    return Number.isSafeInteger(id) && id > 0 && Number.isSafeInteger(quantity) && quantity > 0
      && Number.isSafeInteger(guests) && guests > 0 ? [{ id, quantity, guests }] : [];
  });
}

function splitParty(recommendation: NonNullable<ReturnType<typeof recommendVacationUnits>>, guests: number) {
  let remaining = guests;
  const rooms: Array<{ adults: number }> = [];
  for (const item of recommendation.items) {
    for (let count = 0; count < item.quantity; count += 1) {
      const slotsLeft = recommendation.unitCount - rooms.length;
      const adults = Math.max(1, Math.min(item.maxGuests, remaining - Math.max(0, slotsLeft - 1)));
      rooms.push({ adults });
      remaining -= adults;
    }
  }
  return remaining === 0 ? rooms : [];
}

async function exactSupplierPrice(options: {
  siteId: number;
  from: string;
  till: string;
  nights: number;
  guests: number;
  recommendation: NonNullable<ReturnType<typeof recommendVacationUnits>>;
  token: string;
}) {
  const rooms = splitParty(options.recommendation, options.guests);
  if (!rooms.length) return null;
  const response = await fetch(`${BIZ_API_ROOT}/vacations/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${options.token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ from: options.from, nights: options.nights, rooms, siteID: options.siteId }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { created?: unknown; sites?: Array<Record<string, unknown>> };
  const site = Array.isArray(payload.sites) ? payload.sites.find((item) => Number(item.siteID) === options.siteId) : undefined;
  const cheapest = site?.cheapest && typeof site.cheapest === "object" ? site.cheapest as Record<string, unknown> : null;
  const total = Number(cheapest?.total ?? site?.minTotal);
  if (site?.available !== true || cheapest?.from !== options.from || cheapest?.till !== options.till || !Number.isFinite(total) || total <= 0) return null;
  return { total, checkedAt: typeof payload.created === "string" ? payload.created : new Date().toISOString() };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const place = url.searchParams.get("place") || "";
  const source = legacyAvailabilitySourceFor(place);
  const from = url.searchParams.get("from");
  const till = url.searchParams.get("till");
  const guests = Math.max(1, Number(url.searchParams.get("guests") || 2) || 2);
  if (!source || !validDate(from) || !validDate(till) || !Number.isSafeInteger(guests) || guests > 50) {
    return json({ success: false, error: "invalid_request" }, 400);
  }
  const selectedFrom = from as string;
  const selectedTill = till as string;
  const nights = nightsBetween(selectedFrom, selectedTill);
  if (nights < 1 || nights > 30) return json({ success: false, error: "invalid_stay_length" }, 422);

  try {
    const siteId = Number(source.siteId);
    const rooms = sourceRooms(siteId);
    if (!rooms.length) return json({ success: false, error: "supplier_catalog_unavailable" }, 503);
    const token = await supplierToken();
    const calendar = await supplierStayCalendar({
      siteID: siteId,
      from: selectedFrom,
      till: selectedTill,
      token,
      publishedIds: new Set([siteId]),
    });
    const unitQuotes = rooms.map((room, index) => {
      const assessment = assessCalendarStay(calendar, selectedFrom, selectedTill, room.id);
      const availableCount = assessment.allowed ? Number(assessment.availableUnitCounts[room.id] || 0) : 0;
      return {
        index,
        availability: availableCount > 0 ? "available" as const : "unavailable" as const,
        availableCount,
        totalPrice: 0,
        nightlyPrice: 0,
        maxGuests: room.guests,
      };
    });
    const recommendation = recommendVacationUnits(unitQuotes, guests);
    const price = recommendation ? await exactSupplierPrice({ siteId, from: selectedFrom, till: selectedTill, nights, guests, recommendation, token }) : null;
    const pricedRecommendation = recommendation ? {
      ...recommendation,
      ...(price ? { totalPrice: price.total, nightlyPrice: price.total / nights } : {}),
    } : null;
    const result: LegacyQuote = {
      success: true,
      place,
      from: selectedFrom,
      till: selectedTill,
      availability: recommendation ? "available" : "unavailable",
      availableUnits: unitQuotes.reduce((total, unit) => total + unit.availableCount, 0),
      totalUnits: rooms.reduce((total, room) => total + room.quantity, 0),
      totalPrice: price?.total || 0,
      nightlyPrice: price ? price.total / nights : 0,
      includedGuests: guests,
      units: unitQuotes,
      recommendation: pricedRecommendation,
      source: `${BIZ_API_ROOT}/vacations/${siteId}/calendar`,
      checkedAt: price?.checkedAt || new Date().toISOString(),
    };
    return json(result);
  } catch {
    return json({ success: false, error: "supplier_unavailable" }, 503);
  }
}
