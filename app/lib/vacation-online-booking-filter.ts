import { canShowOnlineBookingBadge } from "./online-booking-eligibility.ts";
import type { LegacyAvailabilityState } from "../components/use-legacy-availability";

type Selection = { from: string; till: string } | null | undefined;

// Search, nearby recovery and map inventories must use the same proof as the
// visible booking stamp. A booking flag or a catalog price alone is not enough.
export function matchesVacationOnlineBooking(
  enabled: boolean,
  state: LegacyAvailabilityState | undefined,
  selection: Selection,
): boolean {
  if (!enabled) return true;
  const quote = state?.quote;
  return canShowOnlineBookingBadge({
    ready: state?.status === "ready",
    onlineBooking: quote?.onlineBooking,
    bookingSupported: quote?.bookingSupported === true,
    availability: quote?.availability,
    price: quote?.nightlyPrice,
    from: quote?.from,
    till: quote?.till,
    selectedFrom: selection?.from,
    selectedTill: selection?.till,
    illustrative: quote?.illustrative,
  });
}
