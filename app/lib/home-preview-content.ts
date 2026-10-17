// This exact accepted supplier cover is a text-bearing promotional poster.
// A verified photo from the SAME gallery is preferred on compact home cards.
const EVENT_POSTER = "/gallery/586acca721dc46e.jpg";
export function homeEventPhotography<T extends { image: string; images?: string[] }>(place: T): T {
  const isPoster = (src: string) => {
    try { return new URL(src, "https://www.vii.co.il").pathname === EVENT_POSTER; }
    catch { return false; }
  };
  if (!isPoster(place.image)) return place;
  const photos = (place.images || []).filter(src => !isPoster(src));
  return photos.length ? { ...place, image: photos[0], images: photos } : place;
}

export function homeReviewExcerpt(value: string) {
  // Strip only the observed import's UI metadata, never edit a guest's words.
  const normalized = value.trim().replace(/\s+/g, " ")
    .replace(/^\d+\s+(?:hours?|days?)\s+ago\s+New\s+(?=[\u0590-\u05ff])/i, "");
  if (normalized.length <= 118) return normalized;
  const candidate = normalized.slice(0, 119);
  const lastWord = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, lastWord > 82 ? lastWord : 118).trim()}...`;
}
