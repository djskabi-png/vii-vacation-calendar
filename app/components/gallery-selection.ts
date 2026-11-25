import type { Property } from "../data/site-data";

export type GallerySelectionItem = {
  category: "place" | "units" | "bedrooms" | "guests";
  topic: string;
  /** Stable entity key; topic remains the human-facing label. */
  topicKey?: string;
};

const keyFor = (item: GallerySelectionItem) => item.topicKey || item.topic;

export function unitGalleryTopicKey(rooms: ReadonlyArray<{ supplierRoomID?: number | null }>, index: number) {
  const id = rooms[index]?.supplierRoomID;
  if (typeof id === "number" && Number.isSafeInteger(id) && id > 0 && rooms.filter(room => room.supplierRoomID === id).length === 1) {
    return `unit:${id}`;
  }
  return `unit:index:${index}`;
}

export function resolveGalleryTopic<T extends GallerySelectionItem>(items: T[], requested: string | null | undefined, preferredCategory?: GallerySelectionTab) {
  if (!requested) return null;
  if (items.some((item) => keyFor(item) === requested)) return requested;
  const category = preferredCategory === "units" || preferredCategory === "bedrooms" || preferredCategory === "guests" ? preferredCategory : undefined;
  const preferred = category && items.find((item) => item.category === category && item.topic === requested);
  if (preferred) return keyFor(preferred);
  const byLabel = items.find(item => item.category === "place" && item.topic === requested) || items.find(item => item.topic === requested);
  return byLabel ? keyFor(byLabel) : null;
}

export type GallerySelectionTab = "all" | GallerySelectionItem["category"] | "videos";

export function generalPlaceGallery({ images, galleryGroups, roomOptions }: Pick<Property, "images" | "galleryGroups" | "roomOptions">) {
  if (!galleryGroups?.length || !roomOptions?.length) return { images, galleryGroups, roomOptions };

  const roomGalleries = roomOptions.map(room => ({
    name: room.name.trim().normalize("NFC"),
    images: new Set(room.images?.length ? room.images : room.image ? [room.image] : []),
  }));
  // Supplier place records can duplicate named unit galleries inside their
  // general image list. Require both the unit name and a shared source,
  // since the supplier may expose only a subset on the unit record.
  const unitGroups = new Map<(typeof galleryGroups)[number], number>();
  for (const group of galleryGroups) {
    const title = group.title.trim().normalize("NFC");
    const matches = roomGalleries
      .map((room, index) => ({ room, index }))
      .filter(({ room }) => room.name === title && group.images.some(image => room.images.has(image)));
    if (matches.length === 1) unitGroups.set(group, matches[0].index);
  }
  if (!unitGroups.size) return { images, galleryGroups, roomOptions };

  const generalGroups = galleryGroups.filter(group => !unitGroups.has(group));
  const generalImages = new Set(generalGroups.flatMap(group => group.images));
  const unitImages = new Set([...unitGroups.keys()].flatMap(group => group.images));
  for (const [group, index] of unitGroups) {
    for (const image of group.images) roomGalleries[index].images.add(image);
  }
  return {
    images: images.filter(image => !unitImages.has(image) || generalImages.has(image)),
    galleryGroups: generalGroups,
    roomOptions: roomOptions.map((room, index) => ({ ...room, images: [...roomGalleries[index].images] })),
  };
}

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

export function galleryTopicTabs<T extends GallerySelectionItem>(items: T[], category: GallerySelectionItem["category"]) {
  const counts = new Map<string, { title: string; count: number }>();
  for (const item of items) {
    if (item.category !== category) continue;
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
