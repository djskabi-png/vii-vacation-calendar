const HILAT_SOURCE = "https://www.vii.co.il/hilat_hanof";
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

function decodeText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
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

  const sourceUrl = new URL(HILAT_SOURCE);
  sourceUrl.searchParams.set("from", selectedFrom);
  sourceUrl.searchParams.set("till", selectedTill);
  try {
    const response = await fetch(sourceUrl, {
      headers: { Accept: "text/html", "User-Agent": "VII availability verifier/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return json({ success: false, error: "legacy_source_unavailable" }, 502);
    const html = await response.text();
    const availabilityMatches = [...html.matchAll(/class=["']free-of["'][^>]*>([\s\S]*?)<\/strong>/gi)].slice(0, 4);
    const priceMatches = [...html.matchAll(/class=["']curr-room-price["'][^>]*>([\s\S]*?)<\/div>/gi)].slice(0, 4);
    if (availabilityMatches.length !== 4 || priceMatches.length !== 4) return json({ success: false, error: "legacy_response_changed" }, 502);

    const availableByUnit = availabilityMatches.map((match) => Number(decodeText(match[1]).match(/\d+/)?.[0] || 0));
    const prices = priceMatches.map((match) => Number(decodeText(match[1]).replace(/[^\d]/g, "")) || 0);
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
      source: sourceUrl.toString(),
      checkedAt: new Date().toISOString(),
    };
    return json(result);
  } catch {
    return json({ success: false, error: "legacy_source_unavailable" }, 502);
  }
}
