import type { ResolvedAvailability } from "../components/property-card";

type CalendarConfirmation = { allowed: boolean; minimumNights?: number } | null | undefined;

export type AvailabilitySnapshot = {
  availability: "available" | "unavailable" | "unknown";
  checkedAt: string;
  source: "supplier-calendar" | "supplier-quote" | "unmanaged";
  from: string;
  till: string;
};

/** Cache may rank a result, but it can never authorize booking by itself. */
export function cachedAvailabilityState(snapshot: AvailabilitySnapshot | null | undefined, now = Date.now()) {
  if (!snapshot || snapshot.source === "unmanaged") return { state: "unknown" as const, revalidate: true, bookable: false };
  const checked = Date.parse(snapshot.checkedAt);
  if (!Number.isFinite(checked) || checked > now + 120_000) return { state: "unknown" as const, revalidate: true, bookable: false };
  const age = Math.max(0, now - checked);
  if (age <= 5 * 60_000) return { state: snapshot.availability, revalidate: true, bookable: false };
  if (age <= 60 * 60_000) return { state: "unknown" as const, revalidate: true, bookable: false };
  return { state: "unknown" as const, revalidate: true, bookable: false };
}

export function liveBookingEligibility(snapshot: AvailabilitySnapshot | null | undefined, revalidated: boolean) {
  return Boolean(revalidated && snapshot && snapshot.source !== "unmanaged" && snapshot.availability === "available");
}

/**
 * A calendar can confirm occupancy when the quote service has no price yet.
 * Explicit supplier refusal reasons remain authoritative, because a positive
 * room calendar must not bypass minimum-stay or arrival restrictions.
 */
export function resolveSupplierAvailability(
  quote: ResolvedAvailability | null | undefined,
  calendar: CalendarConfirmation,
  from: string,
  till: string,
): ResolvedAvailability | null {
  if (quote?.availability === "available") return quote;
  if (quote?.availability === "unavailable" && quote.unavailableReason) return quote;
  if (!calendar?.allowed) return quote ?? null;
  return {
    from,
    till,
    availability: "available",
    showSelectedDates: true,
    ...(calendar.minimumNights ? { minimumNights: calendar.minimumNights } : {}),
  };
}
