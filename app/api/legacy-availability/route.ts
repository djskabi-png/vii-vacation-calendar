import { legacyAvailabilitySourceFor } from "../../lib/legacy-availability-sources";
import { recommendVacationUnits } from "../../lib/vacation-party-recommendation.mjs";

const LEGACY_AVAILABILITY_ENDPOINT = "https://www.vii.co.il/ajax_order.php";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const place = url.searchParams.get("place") || "";
  const source = legacyAvailabilitySourceFor(place);
  const from = url.searchParams.get("from");
  const till = url.searchParams.get("till");
  const guests = Math.max(1, Number(url.searchParams.get("guests") || 2) || 2);
  if (!source || !validDate(from) || !validDate(till)) return json({ success: false, error: "invalid_request" }, 400);
  const selectedFrom = from as string;
  const selectedTill = till as string;
  const nights = nightsBetween(selectedFrom, selectedTill);
  if (nights < 1 || nights > 90) return json({ success: false, error: "invalid_stay_length" }, 422);

  try {
    const sourceRequest = new URLSearchParams({
      act: "roomList",
      sid: source.siteId,
      from: selectedFrom,
      till: selectedTill,
    });
    const response = await fetch(LEGACY_AVAILABILITY_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "VII availability verifier/1.0",
      },
      body: sourceRequest.toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return json({ success: false, error: "legacy_source_unavailable" }, 502);
    const payload = (await response.json()) as { rooms?: unknown; availablesOf?: unknown };
    const rooms = typeof payload.rooms === "string" ? payload.rooms : "";
    const roomMatches = [...rooms.matchAll(/<div class="room\b([^>]*)>/gi)].map((match) => {
      const attributes = match[1];
      const attribute = (name: string) => attributes.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1] || "";
      return { id: attribute("data-id"), price: Number(attribute("data-price")) || 0, available: Number(attribute("data-available")) || 0, maxGuests: Number(attribute("data-maxguests")) || 0 };
    }).filter((room) => room.id);
    if (!roomMatches.length || Number(payload.availablesOf) !== roomMatches.length) return json({ success: false, error: "legacy_response_changed" }, 502);

    const availableByUnit = roomMatches.map((room) => room.available);
    const prices = roomMatches.map((room) => room.price);
    const unitQuotes = availableByUnit.map((availableCount, index) => ({
      index,
      availability: availableCount > 0 ? "available" as const : "unavailable" as const,
      availableCount,
      totalPrice: prices[index] || 0,
      nightlyPrice: prices[index] > 0 ? prices[index] / nights : 0,
      maxGuests: roomMatches[index].maxGuests,
    }));
    const recommendation = recommendVacationUnits(unitQuotes, guests);
    const availableUnits = availableByUnit.reduce((total, count) => total + count, 0);
    const totalPrice = recommendation?.totalPrice || 0;
    const result: LegacyQuote = {
      success: true,
      place,
      from: selectedFrom,
      till: selectedTill,
      availability: recommendation ? "available" : "unavailable",
      availableUnits,
      totalUnits: roomMatches.length,
      totalPrice,
      nightlyPrice: recommendation?.nightlyPrice || (totalPrice > 0 ? totalPrice / nights : 0),
      includedGuests: 2,
      units: unitQuotes,
      recommendation,
      source: source.sourceUrl,
      checkedAt: new Date().toISOString(),
    };
    return json(result);
  } catch {
    return json({ success: false, error: "legacy_source_unavailable" }, 502);
  }
}
