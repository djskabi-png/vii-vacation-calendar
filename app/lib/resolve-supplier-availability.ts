import type { ResolvedAvailability } from "../components/property-card";

type CalendarConfirmation = { allowed: boolean; minimumNights?: number } | null | undefined;

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
