import { canShowOnlineBookingBadge } from "./online-booking-eligibility.ts";

/** Stable online-first ordering. The comparator is only used inside each cohort,
 * so editorial priority and daily rotation remain intact among equivalent items. */
export function prioritizeOnlineFirst<T>(items: readonly T[], isEligible: (item: T) => boolean, compareWithinCohort?: (left: T, right: T) => number): T[] {
  const online: T[] = [];
  const other: T[] = [];
  for (const item of items) (isEligible(item) ? online : other).push(item);
  if (compareWithinCohort) { online.sort(compareWithinCohort); other.sort(compareWithinCohort); }
  return [...online, ...other];
}
export function isHomeDealOnlineEligible(deal: { onlineBooking?: boolean; roomID?: number; total: number; nights: number; from: string; till: string }) {
  const nightly = deal.nights > 0 ? Math.round(deal.total / deal.nights) : 0;
  return canShowOnlineBookingBadge({ ready: true, onlineBooking: deal.onlineBooking, bookingSupported: Number.isSafeInteger(deal.roomID) && Number(deal.roomID) > 0, availability: "available", price: nightly, from: deal.from, till: deal.till, selectedFrom: deal.from, selectedTill: deal.till });
}
