export type GallerySelectionItem = {
  category: "place" | "units" | "bedrooms" | "guests";
  topic: string;
};

export type GallerySelectionTab = "all" | GallerySelectionItem["category"] | "videos";

export function visibleGalleryItems<T extends GallerySelectionItem>(items: T[], tab: GallerySelectionTab, topic: string | null) {
  // A supplier-named gallery is authoritative. Its media can also belong to a
  // unit, but the visual inventory intentionally stores each image once.
  // Topic-first filtering keeps unit deep-links intact after deduplication.
  if (topic) return items.filter((item) => item.topic === topic);
  return tab === "all" ? items : tab === "videos" ? [] : items.filter((item) => item.category === tab);
}
