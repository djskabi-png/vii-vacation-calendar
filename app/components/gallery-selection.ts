export type GallerySelectionItem = {
  category: "place" | "units" | "bedrooms" | "guests";
  topic: string;
};

export type GallerySelectionTab = "all" | GallerySelectionItem["category"] | "videos";

export function gallerySelectionScope<T extends GallerySelectionItem>(items: T[], tab: GallerySelectionTab, topic: string | null = null): GallerySelectionItem["category"] {
  if (tab === "units" || tab === "bedrooms" || tab === "guests") return tab;
  // Preserve old gallery=all links to unit-only topics without combining a
  // room's copy of a photograph with an editorial source gallery.
  if (topic && !items.some(item => item.category === "place" && item.topic === topic)) {
    const unitTopic = items.find(item => item.topic === topic && (item.category === "units" || item.category === "bedrooms"));
    if (unitTopic) return unitTopic.category;
  }
  return "place";
}

export function galleryTopicTabs<T extends GallerySelectionItem>(items: T[], category: GallerySelectionItem["category"] | "all") {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (category !== "all" && item.category !== category) continue;
    if (category === "all" && item.category === "guests") continue;
    counts.set(item.topic, (counts.get(item.topic) || 0) + 1);
  }
  return [...counts].map(([title, count]) => ({ title, count }));
}

export function uniqueGalleryItems<T extends GallerySelectionItem & { src: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    // The same supplier image may intentionally belong to the general gallery
    // and to one or more units. Gallery identity includes the category and
    // topic, so source-level de-duplication must never erase a unit gallery.
    const identity = `${item.category}\u0000${item.topic}\u0000${item.src}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function visibleGalleryItems<T extends GallerySelectionItem>(items: T[], tab: GallerySelectionTab, topic: string | null) {
  if (tab === "videos") return [];
  const scope = gallerySelectionScope(items, tab, topic);
  return items.filter(item => item.category === scope && (!topic || item.topic === topic));
}
