export type GallerySelectionItem = {
  category: "place" | "units" | "bedrooms" | "guests";
  topic: string;
  /** Stable entity key; topic remains the human-facing label. */
  topicKey?: string;
};

const keyFor = (item: GallerySelectionItem) => item.topicKey || item.topic;

export function resolveGalleryTopic<T extends GallerySelectionItem>(items: T[], requested: string | null | undefined, preferredCategory?: GallerySelectionTab) {
  if (!requested) return null;
  if (items.some((item) => keyFor(item) === requested)) return requested;
  const category = preferredCategory === "units" || preferredCategory === "bedrooms" || preferredCategory === "guests" ? preferredCategory : undefined;
  const preferred = category && items.find((item) => item.category === category && item.topic === requested);
  if (preferred) return keyFor(preferred);
  return items.find((item) => item.category === "place" && item.topic === requested)?.topicKey || (items.some((item) => item.topic === requested) ? requested : null);
}

export type GallerySelectionTab = "all" | GallerySelectionItem["category"] | "videos";

export function gallerySelectionScope<T extends GallerySelectionItem>(items: T[], tab: GallerySelectionTab, topic: string | null = null): GallerySelectionItem["category"] {
  if (tab === "units" || tab === "bedrooms" || tab === "guests") return tab;
  // Preserve old gallery=all links to unit-only topics without combining a
  // room's copy of a photograph with an editorial source gallery.
  if (topic && !items.some(item => item.category === "place" && (item.topic === topic || keyFor(item) === topic))) {
    const unitTopic = items.find(item => (item.topic === topic || keyFor(item) === topic) && (item.category === "units" || item.category === "bedrooms"));
    if (unitTopic) return unitTopic.category;
  }
  return "place";
}

export function galleryTopicTabs<T extends GallerySelectionItem>(items: T[], category: GallerySelectionItem["category"] | "all") {
  const counts = new Map<string, { title: string; count: number }>();
  for (const item of items) {
    if (category !== "all" && item.category !== category) continue;
    if (category === "all" && item.category === "guests") continue;
    const key = keyFor(item); const current = counts.get(key);
    counts.set(key, { title: item.topic, count: (current?.count || 0) + 1 });
  }
  return [...counts].map(([key, value]) => key === value.title ? value : ({ key, ...value }));
}

export function uniqueGalleryItems<T extends GallerySelectionItem & { src: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    // The same supplier image may intentionally belong to the general gallery
    // and to one or more units. Gallery identity includes the category and
    // topic, so source-level de-duplication must never erase a unit gallery.
    const identity = `${item.category}\u0000${keyFor(item)}\u0000${item.src}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function visibleGalleryItems<T extends GallerySelectionItem>(items: T[], tab: GallerySelectionTab, topic: string | null) {
  if (tab === "videos") return [];
  const scope = gallerySelectionScope(items, tab, topic);
  return items.filter(item => item.category === scope && (!topic || item.topic === topic || keyFor(item) === topic));
}
