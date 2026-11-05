import legacy from "../data/legacy-amenity-search-index.json" with { type: "json" };
import legacyEvents from "../data/legacy-event-amenity-search-index.json" with { type: "json" };
import { filterIdsFromVerifiedLegacyIds } from "./supplier-amenity-filters.ts";
import { vacationSearchFilterIdsFromText } from "./vacation-search-filter-index.ts";

type LegacyFacts = { ids: number[]; extra?: string[]; accessibility?: string[] };
const entries = legacy.entries as Record<string, LegacyFacts>;

/** Only old vacation projections which predate the complete source index need
 * backfill. A newer explicit array, including [], is authoritative and must
 * never resurrect a removed supplier attribute. No provider call per card. */
export function withLegacyAmenitySearchProjection<T extends Record<string, unknown>>(value: T): T {
  if (value.searchFilterIds !== undefined || typeof value.slug !== "string"
      || !/^vacation-[1-9]\d*$/.test(value.slug)
      || value.world !== undefined && value.world !== "vacations") return value;
  const id = Number(value.slug.slice("vacation-".length));
  if (value.supplierId !== undefined && value.supplierId !== id) return value;
  const facts = entries[value.slug];
  if (!facts) return value;
  const strings = (items: unknown) => Array.isArray(items) ? items.filter((v): v is string => typeof v === "string") : [];
  // Preserve old non-taxonomy search meanings while authoritative structured
  // amenities restore facts lost by truncated card features.
  const derived = vacationSearchFilterIdsFromText(strings(value.features));
  return { ...value, features: [...new Set([...strings(value.features), ...(facts.accessibility || [])])], searchFilterIds: [...new Set([
    ...derived, ...filterIdsFromVerifiedLegacyIds(facts.ids), ...(facts.extra || []),
  ])] };
}

/** Event amenity IDs belong to their own taxonomy. For example accessibility
 * is81 in these observed event profiles, not vacation62. Never expand them
 * through the vacation numeric alias table. */
export function withLegacyEventAmenitySearchProjection<T extends Record<string, unknown>>(value: T): T {
  if (value.searchFilterIds !== undefined || typeof value.slug !== "string"
      || !/^event-[1-9]\d*$/.test(value.slug)
      || value.world !== undefined && value.world !== "events") return value;
  const id = Number(value.slug.slice("event-".length));
  if (value.supplierId !== undefined && value.supplierId !== id) return value;
  const facts = (legacyEvents.entries as Record<string, { supplierId: number; semantic: string[]; observedAmenityIds: number[]; accessibility: string[] }>)[value.slug];
  if (!facts || facts.supplierId !== id) return value;
  const features = Array.isArray(value.features) ? value.features.filter((v): v is string => typeof v === "string") : [];
  return { ...value, features: [...new Set([...features, ...facts.accessibility])], searchFilterIds: [...new Set([
    ...vacationSearchFilterIdsFromText(features), ...facts.semantic,
    ...facts.observedAmenityIds.map(id => `amenity-${id}`),
  ])] };
}
