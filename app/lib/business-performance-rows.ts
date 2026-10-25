import { canonicalBusinessReportScope } from "./business-report-scopes.ts";

export const businessPerformanceBase = { impressions: 0, pageViews: 0, phoneReveals: 0, phoneClicks: 0,
  whatsappLeads: 0, whatsappHandoffs: 0, bookingRequests: 0, uniqueBrowsers: 0, viiBookings: 0, reviews: 0 };
const additive = Object.keys(businessPerformanceBase) as Array<keyof typeof businessPerformanceBase>;

export function mergeBusinessPerformanceRows(...groups: Array<Array<Record<string, unknown>>>) {
  const rows = new Map<string, Record<string, unknown>>();
  for (const group of groups) for (const raw of group) {
    const placeId = String(raw.placeId || "").trim();
    const world = canonicalBusinessReportScope(String(raw.world || ""));
    if (!placeId || !world) continue;
    const key = `${world}:${placeId}`;
    const current = rows.get(key);
    const merged = { ...businessPerformanceBase, ...(current || {}), ...raw, placeId, world };
    if (current) for (const field of additive) merged[field] = Number(current[field] || 0) + Number(raw[field] || 0);
    rows.set(key, merged);
  }
  return [...rows.values()];
}
