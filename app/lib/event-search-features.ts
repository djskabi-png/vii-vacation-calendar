import labels from "../data/event-search-amenity-labels.json" with { type: "json" };

export function eventFeatureTokens(selection: string) {
  return [...new Set(selection.split(",").map(value => value.trim()).filter(value => value && value !== "הכל"))];
}

/** Event supplier IDs retain their own namespace. Unknown or removed facts
 * never become an unfiltered result, and multiple selected facts use AND. */
export function eventMatchesFeatureSelection(place: { features?: readonly string[]; searchFilterIds?: readonly string[] }, selection: string) {
  return eventFeatureTokens(selection).every(feature => /^amenity-[1-9]\d*$/.test(feature)
    ? place.searchFilterIds?.includes(feature) === true
    : place.features?.includes(feature) === true);
}

export function eventFeatureSelectionLabel(selection: string) {
  return eventFeatureTokens(selection).map(feature => (labels as Record<string,string>)[feature]
    || (/^amenity-/.test(feature) ? "מתקנים ושירותים נוספים" : feature)).join(" · ");
}
