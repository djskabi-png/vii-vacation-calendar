import type { EventPlace } from "../data/site-data";

export function eventPlaceHref(place: Pick<EventPlace, "slug" | "sourcePropertySlug">) {
  return place.sourcePropertySlug
    ? `/business?id=${place.sourcePropertySlug}&mode=events`
    : `/events/place/${place.slug}`;
}

// A dated event offer belongs to the event supplier ID, even when the same
// business also has a vacation listing. Keep its event-specific quote flow.
export function eventOfferHref(place: Pick<EventPlace, "slug">, selection: URLSearchParams) {
  return `/events/place/${place.slug}?${selection}`;
}
