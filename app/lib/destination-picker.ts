import { canonicalSearchLocation, locationMatchesQuery, normalizeGeographicName } from "./geographic-names.ts";
import type { PublicGeographyNode } from "./geography-search.ts";

export const DESTINATION_PAGE_SIZE = 8;
export const QUICK_DESTINATIONS = ["כל הארץ", "צפון", "מרכז", "דרום", "ירושלים והרי יהודה", "אילת והערבה"];
export type Destination = { key: string; value: string; level: PublicGeographyNode["level"] | "country"; parentKey: string | null; aliases: string[] };

/** The inventory stays complete. Limits apply only after matching or at a browse level. */
export function destinationInventory(nodes: readonly PublicGeographyNode[], fallback: readonly string[]): Destination[] {
  const result: Destination[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (!node || !["district", "area", "city"].includes(node.level) || typeof node.key !== "string" || typeof node.title !== "string" || !node.title.trim()) continue;
    const value = canonicalSearchLocation(node.title);
    const identity = `${node.level}:${normalizeGeographicName(value)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push({ key: node.key, value, level: node.level, parentKey: node.parentKey || null, aliases: [node.title, node.titleEn || "", node.slug || ""] });
  }
  for (const value of [...QUICK_DESTINATIONS, ...fallback].map(canonicalSearchLocation)) {
    if (!value || result.some(item => item.value === value)) continue;
    result.push({ key: `fallback:${value}`, value, level: value === "כל הארץ" ? "country" : "area", parentKey: null, aliases: [] });
  }
  return result;
}

export function matchingDestinations(inventory: readonly Destination[], query: string, translate: (text: string) => string = text => text): Destination[] {
  const target = normalizeGeographicName(query);
  if (!target) return [];
  const score = (item: Destination) => {
    const labels = [item.value, ...item.aliases, translate(item.value)].map(normalizeGeographicName);
    return labels.includes(target) ? 0 : labels.some(label => label.startsWith(target)) ? 1 : 2;
  };
  return inventory.filter(item => locationMatchesQuery(item.value, query) || [item.value, ...item.aliases, translate(item.value)].some(label => normalizeGeographicName(label).includes(target)))
    .sort((a, b) => score(a) - score(b) || a.value.localeCompare(b.value, "he"))
    .slice(0, DESTINATION_PAGE_SIZE);
}

export function destinationChildren(inventory: readonly Destination[], parentKey: string | null): Destination[] {
  const managedRoots = inventory.filter(item => item.level === "district" && item.parentKey === null);
  return inventory.filter(item => parentKey === null
    ? managedRoots.length > 0 ? !item.key.startsWith("fallback:") && item.parentKey === null : item.level !== "city" && item.level !== "country" && item.parentKey === null
    : item.parentKey === parentKey)
    .sort((a, b) => a.value.localeCompare(b.value, "he"));
}

export function destinationPage(items: readonly Destination[], page: number) {
  const pages = Math.max(1, Math.ceil(items.length / DESTINATION_PAGE_SIZE));
  const current = Math.min(pages - 1, Math.max(0, Number.isFinite(page) ? Math.trunc(page) : 0));
  return { items: items.slice(current * DESTINATION_PAGE_SIZE, (current + 1) * DESTINATION_PAGE_SIZE), current, pages };
}

export function recentDestinations(raw: unknown, inventory: readonly Destination[]): string[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set(inventory.map(item => item.value));
  return [...new Set(raw.filter((item): item is string => typeof item === "string").map(canonicalSearchLocation))].filter(value => value !== "כל הארץ" && valid.has(value)).slice(0, 3);
}
