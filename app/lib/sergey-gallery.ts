import { localGalleryMediaUrl } from "./legacy-gallery-media.ts";
import { orderedObjectEntries } from "./supplier-gallery-contract.ts";

type Gallery = { id?: unknown; galleryID?: unknown; galleryId?: unknown; title?: unknown; pictures?: unknown; roomID?: unknown; _wireKey?: string };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function galleryList(value: unknown): Gallery[] {
  return (Array.isArray(value) ? value.map((item) => ["", item] as const) : orderedObjectEntries(value)).map(([key, item]) => {
    const row = record(item);
    return Object.prototype.hasOwnProperty.call(row, "id") || Object.prototype.hasOwnProperty.call(row, "galleryID") || Object.prototype.hasOwnProperty.call(row, "galleryId")
      ? row as Gallery : { ...row, _wireKey: key } as Gallery;
  });
}

function imageUrl(value: unknown): string | null {
  return localGalleryMediaUrl(value);
}

function images(galleries: Gallery[]): string[] {
  return [...new Set(galleries.flatMap((gallery) => Array.isArray(gallery.pictures)
    ? gallery.pictures.map(imageUrl).filter((url): url is string => Boolean(url)) : []))];
}

export function sergeyPlaceGalleryGroups(galleries: unknown): Array<{ id?: string; title: string; images: string[] }> {
  return galleryList(galleries).map((gallery, index) => ({
    ...((gallery.id ?? gallery.galleryID ?? gallery.galleryId ?? gallery._wireKey) !== undefined && String(gallery.id ?? gallery.galleryID ?? gallery.galleryId ?? gallery._wireKey).trim()
      ? { id: String(gallery.id ?? gallery.galleryID ?? gallery.galleryId ?? gallery._wireKey).trim() } : {}),
    title: typeof gallery.title === "string" && gallery.title.trim() ? gallery.title.trim() : `גלריה ${index + 1}`,
    images: images([gallery]),
  })).filter((gallery) => gallery.images.length);
}

function comparableTitle(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").replace(/^סוויטת(?=\s)/, "סוויטה") : "";
}

// One verified provider wording alias, not a fuzzy amenity/title match.
function unitTitleAlias(value: string) {
  return value.replace(/^יחידות אירוח עם ג['’׳]?קוזי$/, "יחידות עם ג'קוזי").replace(/^יחידות עם ג['’׳]?קוזי$/, "יחידות עם ג'קוזי");
}

export function sergeyPlaceImages(galleries: unknown): string[] {
  return images(galleryList(galleries));
}

export function sergeyRoomImages(room: Record<string, unknown>, siteGalleries: unknown): string[] {
  if (Object.prototype.hasOwnProperty.call(room, "galleries")) {
    const explicit = galleryList(room.galleries);
    if (!explicit.length) return [];
  }
  const roomGalleries = galleryList(room.galleries);
  if (roomGalleries.length) return images(roomGalleries);
  const roomId = Number(room.roomID);
  const galleries = galleryList(siteGalleries);
  const idMatches = Number.isSafeInteger(roomId) && roomId > 0
    ? galleries.filter((gallery) => Number(gallery.roomID) === roomId) : [];
  if (idMatches.length) return images(idMatches);
  const title = comparableTitle(room.roomName);
  if (!title) return [];
  // An explicit foreign room ID always outranks a title coincidence.
  const unassigned = galleries.filter(gallery => !Number(gallery.roomID));
  const exact = unassigned.filter((gallery) => comparableTitle(gallery.title) === title);
  if (exact.length) return images(exact);
  const aliased = unassigned.filter((gallery) => unitTitleAlias(comparableTitle(gallery.title)) === unitTitleAlias(title));
  return aliased.length === 1 ? images(aliased) : [];
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
