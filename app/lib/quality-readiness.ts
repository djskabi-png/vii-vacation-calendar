import { homeDealDates, homeDealPeriods, type HomeDealPeriod } from './home-deal-dates.ts';
import { eventDealPresets } from './event-deal-dates.ts';
import { EVENT_DISCOVERY_VERSION, EVENT_DISCOVERY_MAX_AGE_MS } from './event-discovery-contract.ts';
export const DISCOVERY_READINESS_VERSION = 'discovery-readiness-v1' as const;
export const discoveryReadinessDefinitions = [
    ...homeDealPeriods.map(({ id }) => ({ checkId: `discovery.vacation.${id}.ready`, world: 'vacations', route: `/api/vii/home-deals?period=${id}&guests=2`, period: id })),
    ...(['lastminute', 'thursday', 'friday'] as const).map(preset => ({ checkId: `discovery.events.${preset}.ready`, world: 'events', route: '/api/vii/live-search', preset })),
] as const;
export type ReadinessResult = {
    ok: true;
} | {
    ok: false;
    reason: string;
};
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const positive = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
function fresh(value: unknown, now: number, maxAge: number) { const cache = record(value), checked = Date.parse(typeof cache?.checkedAt === 'string' ? cache.checkedAt : ''); return Number.isFinite(checked) && checked <= now && now - checked <= maxAge; }
export function validateVacationReadiness(value: unknown, expected: {
    from: string;
    till: string;
    nights: number;
}, guests: number, now = Date.now(), period?: HomeDealPeriod): ReadinessResult {
    const row = record(value), dates = record(row?.dates);
    if (!row || !dates || dates.from !== expected.from || dates.till !== expected.till || dates.nights !== expected.nights || period && row.period !== period)
        return { ok: false, reason: 'wrong_period' };
    if (row.availabilityStatus !== 'verified' || !fresh(row.cache, now, 60 * 60000))
        return { ok: false, reason: 'snapshot_not_verified' };
    if (!Array.isArray(row.deals))
        return { ok: false, reason: 'invalid_deals' };
    const seen = new Set<number>();
    for (const value of row.deals) {
        const deal = record(value);
        if (!deal || !positive(deal.siteID) || seen.has(Number(deal.siteID)) || deal.priceGuests !== guests || typeof deal.total !== 'number' || !Number.isFinite(deal.total) || deal.total <= 0 || deal.from !== expected.from || deal.till !== expected.till || deal.nights !== expected.nights)
            return { ok: false, reason: 'deal_contract' };
        seen.add(Number(deal.siteID));
    }
    return { ok: true };
}
export function validateEventReadiness(value: unknown, expected: {
    date: string;
    guests: number;
}, now = Date.now()): ReadinessResult {
    const row = record(value), scope = record(row?.scope);
    if (!row || row.discoveryVersion !== EVENT_DISCOVERY_VERSION || row.world !== 'events' || !scope || scope.date !== expected.date || scope.guests !== expected.guests || row.availabilityStatus === 'refreshing' || !fresh(row.cache, now, EVENT_DISCOVERY_MAX_AGE_MS))
        return { ok: false, reason: 'snapshot_not_verified' };
    if (!Array.isArray(row.results) || !Array.isArray(row.places) || row.results.length !== row.places.length)
        return { ok: false, reason: 'invalid_results' };
    const ids = new Set<number>();
    for (let index = 0; index < row.results.length; index++) {
        const offer = record(row.results[index]), place = record(row.places[index]);
        if (!offer || !place || !positive(offer.siteID) || ids.has(Number(offer.siteID)) || place.slug !== `event-${offer.siteID}` || offer.available !== true || offer.from !== expected.date || offer.till !== undefined && offer.till !== expected.date || offer.priceGuests !== expected.guests || offer.slot !== 'morning' && offer.slot !== 'evening' || offer.total !== null && (typeof offer.total !== 'number' || !Number.isFinite(offer.total) || offer.total <= 0))
            return { ok: false, reason: 'offer_contract' };
        ids.add(Number(offer.siteID));
    }
    return { ok: true };
}
// Only these server-owned checks can construct the reviewed discovery POST.
// There is no caller-supplied method, URL, payload or general POST facility.
export function discoveryReadinessProbe(checkId: string, now = new Date()) {
    const definition = discoveryReadinessDefinitions.find(entry => entry.checkId === checkId);
    if (!definition)
        return null;
    if ('period' in definition) {
        const dates = homeDealDates(definition.period, now);
        return { route: definition.route, method: 'GET' as const, validate: (value: unknown, completedAt: number) => validateVacationReadiness(value, dates, 2, completedAt, definition.period) };
    }
    const date = eventDealPresets(now).find(entry => entry.id === definition.preset)!.date;
    return { route: definition.route, method: 'POST' as const, body: JSON.stringify({ world: 'events', from: date, till: date, guests: 20, includePlaces: true }), validate: (value: unknown, completedAt: number) => validateEventReadiness(value, { date, guests: 20 }, completedAt) };
}
