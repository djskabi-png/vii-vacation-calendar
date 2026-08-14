const HILAT_SOURCE = "https://www.vii.co.il/hilat_hanof";
const HILAT_AVAILABILITY_SOURCE = "https://www.vii.co.il/ajax_order.php";
const FIRST_DATE = "2026-08-14";
const LAST_DATE = "2026-10-14";

type LegacyQuote = {
  success: true;
  place: "hilat-hanof";
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
  }>;
  source: string;
  checkedAt: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
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
  const from = url.searchParams.get("from");
  const till = url.searchParams.get("till");
  if (place !== "hilat-hanof" || !validDate(from) || !validDate(till)) return json({ success: false, error: "invalid_request" }, 400);
  const selectedFrom = from as string;
  const selectedTill = till as string;
  const nights = nightsBetween(selectedFrom, selectedTill);
  if (selectedFrom < FIRST_DATE || selectedTill > LAST_DATE || nights < 1 || nights > 62) return json({ success: false, error: "outside_verified_window" }, 422);

  try {
    const sourceRequest = new URLSearchParams({
      act: "roomList",
      sid: "11",
      from: selectedFrom,
      till: selectedTill,
    });
    const response = await fetch(HILAT_AVAILABILITY_SOURCE, {
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
    const roomMatches = [...rooms.matchAll(/<div class="room[^>]*data-id="([^"]+)"[^>]*data-price="([^"]+)"[^>]*data-available="([^"]+)"/gi)].slice(0, 4);
    if (roomMatches.length !== 4 || Number(payload.availablesOf) !== 4) return json({ success: false, error: "legacy_response_changed" }, 502);

    const availableByUnit = roomMatches.map((match) => Number(match[3]) || 0);
    const prices = roomMatches.map((match) => Number(match[2]) || 0);
    const availableUnits = availableByUnit.filter((count) => count > 0).length;
    const availablePrices = prices.filter((price, index) => availableByUnit[index] > 0 && price > 0);
    const totalPrice = availablePrices.length ? Math.min(...availablePrices) : Math.max(0, ...prices);
    const result: LegacyQuote = {
      success: true,
      place: "hilat-hanof",
      from: selectedFrom,
      till: selectedTill,
      availability: availableUnits > 0 ? "available" : "unavailable",
      availableUnits,
      totalUnits: 4,
      totalPrice,
      nightlyPrice: totalPrice > 0 ? totalPrice / nights : 0,
      includedGuests: 2,
      units: availableByUnit.map((availableCount, index) => ({
        index,
        availability: availableCount > 0 ? "available" : "unavailable",
        availableCount,
        totalPrice: prices[index] || 0,
        nightlyPrice: prices[index] > 0 ? prices[index] / nights : 0,
      })),
      source: HILAT_SOURCE,
      checkedAt: new Date().toISOString(),
    };
    return json(result);
  } catch {
    return json({ success: false, error: "legacy_source_unavailable" }, 502);
  }
}
