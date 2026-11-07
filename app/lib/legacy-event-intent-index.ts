import pages from "../data/legacy-event-search-pages.json" with { type: "json" };
import { canonicalSearchLocation } from "./geographic-names.ts";
import { normalizeEventVenueType } from "./event-search-taxonomy.ts";

type EventIntent = { location?: string; type?: string; features?: string; eventType?: string; accessible?: string; noise?: string };
type LegacyPage = { canonicalPath: string; location: string; filters?: Record<string, string> };
export const legacyEventIntentIndex = pages.map(({ canonicalPath, location, filters }) => ({ canonicalPath, location, filters })) as LegacyPage[];

const aliases: Record<string, string> = { "לופט": "לופטים", "וילה": "וילות", "מתחם אירוח": "מתחמי אירוח" };
function norm(key: string, value: string) {
  const clean = value.trim();
  if (key === "location") return canonicalSearchLocation(clean);
  if (key === "type") return aliases[clean] || normalizeEventVenueType(clean);
  if (key === 'features') return [...new Set(clean.split(',').map(item => item.trim()).filter(Boolean))].sort().join(',');
  return clean;
}
export function canonicalLegacyEventSearchPath(input: EventIntent) {
  const requested = Object.entries(input).filter(([key, value]) => typeof value === "string" && value.trim() && value !== "הכל" && value !== "כל הארץ" && !(['accessible', 'noise'].includes(key) && value === '0')).map(([key, value]) => [key, norm(key, value!)] as const);
  if (requested.some(([key]) => !["location", "type", "features", "eventType", "accessible", "noise"].includes(key))) return null;
  const target = new Map(requested);
  const match = legacyEventIntentIndex.find(page => {
    const filters = new Map<string, string>();
    if (page.location && page.location !== "כל הארץ") filters.set("location", norm("location", page.location));
    for (const [key, value] of Object.entries(page.filters || {})) filters.set(key, norm(key, value));
    return filters.size === target.size && [...filters].every(([key, value]) => target.get(key) === value);
  });
  return match?.canonicalPath || null;
}
