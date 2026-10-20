type TourProperty = { slug: string; active?: boolean; videos?: readonly { src: string; poster: string; verifiedRealVideo?: true }[] };

export function homeTourVideos<T extends { src: string; poster: string; verifiedRealVideo?: true }>(videos: readonly T[] | undefined): T[] {
  const usable = (value: string) => typeof value === "string" && /^(?:https?:\/\/|\/(?!\/))\S+$/i.test(value.trim());
  return (videos || []).filter(video => video.verifiedRealVideo === true && usable(video.src) && usable(video.poster));
}

// An inactive listing or illustrative demo must not be reintroduced by the
// curated static fallback. Filter before limits, and keep verified video/poster
// pairs together rather than borrowing another business's photography.
export function eligibleHomeTourProperties<T extends TourProperty>(properties: readonly T[]): T[] {
  const seen = new Set<string>();
  return properties.filter((property) => {
    if (property.active === false || !homeTourVideos(property.videos).length || seen.has(property.slug)) return false;
    seen.add(property.slug);
    return true;
  });
}
