export const HOME_OFFER_MAX_AGE_MS = 60 * 60_000;

export function homeOfferCheckedAt(value: { cache?: { checkedAt?: string } } | null | undefined) {
  const raw = value?.cache?.checkedAt;
  const time = typeof raw === "string" ? Date.parse(raw) : NaN;
  return Number.isFinite(time) ? time : null;
}

export function isFreshHomeOffer(value: { cache?: { checkedAt?: string } } | null | undefined, now = Date.now()) {
  const checkedAt = homeOfferCheckedAt(value);
  return checkedAt !== null && checkedAt <= now && now - checkedAt < HOME_OFFER_MAX_AGE_MS;
}

export function validHomeOfferResponse(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const row = value as { availabilityStatus?: string; deals?: unknown[]; cache?: { checkedAt?: string } };
  if (!Array.isArray(row.deals)) return false;
  return row.availabilityStatus === "refreshing" ? row.deals.length === 0
    : row.availabilityStatus === "verified" && isFreshHomeOffer(row);
}
