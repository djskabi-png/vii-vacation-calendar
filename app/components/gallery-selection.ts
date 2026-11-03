export type GallerySelectionItem = {
  category: "place" | "units" | "bedrooms" | "guests";
  topic: string;
};

export type GallerySelectionTab = "all" | GallerySelectionItem["category"] | "videos";

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
  // A supplier-named gallery is authoritative. Its media can also belong to a
  // unit. Topic-first filtering keeps unit deep-links intact while the item
  // builder preserves every category and topic identity.
  if (topic) return items.filter((item) => item.topic === topic);
  return tab === "all" ? items : tab === "videos" ? [] : items.filter((item) => item.category === tab);
}
