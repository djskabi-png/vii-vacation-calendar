import { eventDealDate } from './event-deal-dates.ts';
import { firstDealDate } from './deal-clock.ts';

export const SPA_DISCOVERY_DAYS = 6;
export function spaDealDays(now = new Date()) {
  const offset = firstDealDate(now) === eventDealDate(0, now) ? 0 : 1;
  return Array.from({ length: SPA_DISCOVERY_DAYS }, (_, index) => eventDealDate(offset + index, now));
}
export function supportedSpaDealDate(date: string, now = new Date(), includeToday = false) {
  return spaDealDays(now).includes(date) || (includeToday && date === eventDealDate(0, now));
}

/** Local rail state changes keep the current document and every unrelated filter. */
export function spaRailSelectionHref(pathname: string, params: URLSearchParams, date: string, audience: string, sectionId: string) {
  const query = new URLSearchParams(params);
  query.set('spaDealDate', date);
  query.set('spaDealFor', audience);
  return `${pathname}?${query}#${sectionId}`;
}
