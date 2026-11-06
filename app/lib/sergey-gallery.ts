import { localGalleryMediaUrl } from "./legacy-gallery-media.ts";

type Gallery = { title?: unknown; pictures?: unknown; roomID?: unknown };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function galleryList(value: unknown): Gallery[] {
  return (Array.isArray(value) ? value : Object.values(record(value))).map((item) => record(item));
}

function imageUrl(value: unknown): string | null {
  return localGalleryMediaUrl(value);
}

function images(galleries: Gallery[]): string[] {
  return [...new Set(galleries.flatMap((gallery) => Array.isArray(gallery.pictures)
    ? gallery.pictures.map(imageUrl).filter((url): url is string => Boolean(url)) : []))];
}

export function sergeyPlaceGalleryGroups(galleries: unknown): Array<{ title: string; images: string[] }> {
  return galleryList(galleries).map((gallery, index) => ({
    title: typeof gallery.title === "string" && gallery.title.trim() ? gallery.title.trim() : `גלריה ${index + 1}`,
    images: images([gallery]),
  })).filter((gallery) => gallery.images.length);
}

function comparableTitle(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").replace(/^סוויטת(?=\s)/, "סוויטה") : "";
}

// Provider gallery titles are not a stable foreign key. Some generations
// call a unit "יחידות עם ג'קוזי" while the matching gallery is titled
// "יחידות אירוח עם ג'קוזי". Allow only a conservative distinctive-token
// match after exact roomID and exact-title matching have failed. Generic
// words alone must never assign a shared gallery to a unit.
const genericUnitTitleTokens = new Set(["יחידה", "יחידות", "אירוח", "סוויטה", "סוויטות", "צימר", "צימרים"]);
function distinctiveTitleTokens(value: string) {
  return [...new Set(value.replace(/[,'’׳"״]/g, "").split(/\s+/).filter((token) => token.length > 2 && !genericUnitTitleTokens.has(token)))];
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
  const exact = galleries.filter((gallery) => comparableTitle(gallery.title) === title);
  if (exact.length) return images(exact);
  const roomTokens = distinctiveTitleTokens(title);
  if (!roomTokens.length) return [];
  const semantic = galleries.filter((gallery) => {
    const galleryTokens = new Set(distinctiveTitleTokens(comparableTitle(gallery.title)));
    return roomTokens.every((token) => galleryTokens.has(token));
  });
  return images(semantic);
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
