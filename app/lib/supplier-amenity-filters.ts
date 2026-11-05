import taxonomy from "../data/vacation-amenity-taxonomy.json" with { type: "json" };

export const supplierAmenityFilters = taxonomy.items;
const normalized = (value: string) => value.normalize("NFKC").replace(/[׳’‘]/g, "'").replace(/[״“”]/g, '"').replace(/\s+/g, " ").trim();
export const amenityBaseLabel = (value: string) => normalized(value).split(/\s+[-–—]\s+/u)[0];
const knownIds = new Set(taxonomy.items.flatMap((item) => [item.filterId, ...item.implies]));
export function validCanonicalAmenityFilter(id: string) {
  return knownIds.has(id) || /^amenity-[1-9]\d*$/.test(id);
}
export function amenityFilterLabel(id: string) {
  return taxonomy.items.find((item) => item.filterId === id)?.title;
}
function identities(item: typeof taxonomy.items[number]) {
  return [item.filterId, `amenity-${item.id}`, ...item.implies];
}
export function filterIdsFromVerifiedLegacyIds(ids: readonly number[]) {
  return [...new Set(ids.flatMap((id) => {
    const item = taxonomy.items.find((row) => row.id === id);
    return item ? identities(item) : [`amenity-${id}`];
  }))];
}
/** Structured positive amenity labels only. Free prose and negations do not
 * establish a supplier attribute. Keep qualifications in the original data. */
export function filterIdsFromStructuredAmenityLabels(labels: readonly string[], category = "") {
  const result = new Set<string>();
  for (const label of labels) {
    const base = amenityBaseLabel(label);
    let matches = taxonomy.items.filter((item) => normalized(item.title) === base);
    if (matches.length > 1) {
      const scoped = matches.filter((item) => item.category === category);
      if (scoped.length) matches = scoped;
    }
    if (!matches.length) continue;
    // A duplicate title without category cannot invent a specific numeric ID.
    const common = identities(matches[0]).filter((id) => matches.every((item) => identities(item).includes(id)));
    for (const id of common) result.add(id);
  }
  return [...result];
}

/** Preserve every upstream ID and parent, even when no UI alias exists.
 * Human aliases require a matching taxonomy title, so an ID reused by another
 * supplier world cannot silently acquire a vacation meaning. */
export function filterIdsFromSupplierAmenityIds(values: unknown, index: { amenities: Map<number, { id: number; parentId: number; title: string; filterTitle: string }> }) {
  const result = new Set<string>();
  for (const value of Array.isArray(values) ? values : []) {
    const id = typeof value === "number" ? value : value && typeof value === "object" ? value.id : null;
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    result.add(`amenity-${id}`);
    let current = index.amenities.get(id);
    const visited = new Set<number>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      result.add(`amenity-${current.id}`);
      const known = taxonomy.items.find((item) => item.id === current!.id
        && [current!.title, current!.filterTitle].some((title) => normalized(title) === normalized(item.title)));
      if (known) for (const alias of identities(known)) result.add(alias);
      current = current.parentId ? index.amenities.get(current.parentId) : undefined;
    }
  }
  return [...result];
}
