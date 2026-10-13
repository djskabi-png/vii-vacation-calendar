type Gallery = { title?: unknown; pictures?: unknown; roomID?: unknown };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function galleryList(value: unknown): Gallery[] {
  return (Array.isArray(value) ? value : Object.values(record(value))).map((item) => record(item));
}

function imageUrl(value: unknown): string | null {
  return typeof value === "string" && /^\/gallery\/[\w.-]+$/.test(value)
    ? new URL(value, "https://www.vii.co.il").href : null;
}

function images(galleries: Gallery[]): string[] {
  return [...new Set(galleries.flatMap((gallery) => Array.isArray(gallery.pictures)
    ? gallery.pictures.map(imageUrl).filter((url): url is string => Boolean(url)) : []))];
}

function comparableTitle(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").replace(/^סוויטת(?=\s)/, "סוויטה") : "";
}

export function sergeyPlaceImages(galleries: unknown): string[] {
  return images(galleryList(galleries));
}

export function sergeyRoomImages(room: Record<string, unknown>, siteGalleries: unknown): string[] {
  const roomGalleries = galleryList(room.galleries);
  if (roomGalleries.length) return images(roomGalleries);
  const roomId = Number(room.roomID);
  const galleries = galleryList(siteGalleries);
  const idMatches = Number.isSafeInteger(roomId) && roomId > 0
    ? galleries.filter((gallery) => Number(gallery.roomID) === roomId) : [];
  if (idMatches.length) return images(idMatches);
  const title = comparableTitle(room.roomName);
  if (!title) return [];
  return images(galleries.filter((gallery) => comparableTitle(gallery.title) === title));
}

export function sergeyRoomFeatureGroups(room: Record<string, unknown>) {
  const spaces = Array.isArray(room.spaces) ? room.spaces : [];
  return spaces.map((value) => {
    const space = record(value);
    const features = Array.isArray(space.features) ? space.features : [];
    const items = [...new Set(features.map((feature) => record(feature).description)
      .filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))];
    return { title: typeof space.title === "string" && space.title.trim() ? space.title.trim() : "ביחידה", items };
  }).filter((group) => group.items.length);
}

