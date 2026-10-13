import type { EventPlace } from "../data/site-data";

export function eventPlaceHref(place: EventPlace) {
  return place.sourcePropertySlug
    ? `/business?id=${place.sourcePropertySlug}&mode=events`
    : `/events/place/${place.slug}`;
}
