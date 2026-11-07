export type SeedContext = { period: string; guests: number; locale: string; region?: string | null; from: string; till: string; nights?: number; clockKey?: string; now?: number };
type Seed = { availabilityStatus?: string; period?: string; guests?: number; locale?: string; region?: string | null; clockKey?: string; dates?: { from?: string; till?: string; nights?: number }; deals?: unknown[]; cache?: { checkedAt?: string } };

export function acceptedHomeDealsSeed(value: unknown, expected: SeedContext, maxAgeMs = 60 * 60_000) {
  if (!value || typeof value !== "object") return false;
  const seed = value as Seed;
  if (seed.availabilityStatus !== "verified" || seed.period !== expected.period || seed.guests !== expected.guests || seed.locale !== expected.locale || (seed.region || null) !== (expected.region || null)) return false;
  if (expected.clockKey && seed.clockKey !== expected.clockKey) return false;
  if (seed.dates?.from !== expected.from || seed.dates?.till !== expected.till || (expected.nights !== undefined && seed.dates?.nights !== expected.nights) || !Array.isArray(seed.deals)) return false;
  if (seed.deals.some(value => {
    if (!value || typeof value !== "object") return true;
    const deal = value as { priceGuests?: number; from?: string; till?: string; nights?: number };
    return deal.priceGuests !== expected.guests || deal.from !== expected.from || deal.till !== expected.till || (expected.nights !== undefined && deal.nights !== expected.nights);
  })) return false;
  const checked = Date.parse(seed.cache?.checkedAt || "");
  const now = expected.now ?? Date.now();
  return Number.isFinite(checked) && checked <= now && now - checked < maxAgeMs;
}
