import { canShowOnlineBookingBadge } from "./online-booking-eligibility.ts";
import type { LegacyAvailabilityState } from "../components/use-legacy-availability";
import { hasOnlineCapability } from "./online-booking-capability.ts";

type Selection = { from: string; till: string } | null | undefined;

// Undated discovery uses capability, never availability on an unrelated date.
// Dated results keep the existing strict selected-stay proof.
export function matchesVacationOnlineBooking(
  enabled: boolean,
  state: LegacyAvailabilityState | undefined,
  selection: Selection,
  discovery?: { undated: boolean; capability?: { checkedAt: number }; capabilityUnavailable?: boolean },
): boolean {
  if (!enabled) return true;
  // Capability belongs to the business, not to one supplier response. A
  // dated quote proves availability and price, but it must not be the only
  // proof that the business supports online booking.
  if (hasOnlineCapability(discovery?.capability)) return true;
  if (discovery?.capabilityUnavailable) return true;
  if (!selection && discovery?.undated) return false;
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
