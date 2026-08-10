import type { DiscoveryItem } from "./world-data";
import { getSpaDetails } from "./spa-details";
import { matchesSearchLocation } from "./search-taxonomy";
import { getSpaLanding, spaItemMatches, spaLandingHref, spaLandings, type SpaLanding } from "./spa-landings";

export const spaSearchRegions = [
  { slug: "north", label: "צפון" },
  { slug: "haifa", label: "חיפה" },
  { slug: "kinneret", label: "כנרת" },
  { slug: "center", label: "מרכז" },
  { slug: "tel-aviv", label: "תל אביב" },
  { slug: "jerusalem", label: "ירושלים והסביבה" },
  { slug: "south", label: "דרום ונגב" },
  { slug: "eilat", label: "אילת והסביבה" },
] as const;

export const spaSearchAudiences = [
  { id: "single", slug: "single", label: "יחיד", title: "ליחיד", sourceAudience: "יחיד" },
  { id: "couple", slug: "couples", label: "זוגי", title: "לזוג", sourceAudience: "זוג" },
  { id: "group", slug: "groups", label: "קבוצה", title: "לקבוצה", sourceAudience: "קבוצה" },
  { id: "day-pass", slug: "spa-day-pass", label: "יום כיף", title: "ליום כיף", sourceAudience: "יום כיף" },
] as const;

export type SpaSearchAudienceId = (typeof spaSearchAudiences)[number]["id"];

export type SpaSearchState = {
  region?: (typeof spaSearchRegions)[number];
  audience?: (typeof spaSearchAudiences)[number];
  features: SpaLanding[];
};

export function spaSearchStateFromSegments(segments: string[] | undefined): SpaSearchState | null {
  const state: SpaSearchState = { features: [] };
  for (const segment of segments || []) {
    const region = spaSearchRegions.find((entry) => entry.slug === segment);
    const audience = spaSearchAudiences.find((entry) => entry.slug === segment);
    const feature = getSpaLanding(segment);
    if (region && !state.region) state.region = region;
    else if (audience && !state.audience) state.audience = audience;
    else if (feature && !state.features.some((entry) => entry.id === feature.id)) state.features.push(feature);
    else return null;
  }
  return state.region || state.audience || state.features.length ? state : null;
}

export function spaSearchStateFromValues(location?: string, audienceId?: string, featureIds: string[] = []): SpaSearchState {
  return {
    region: spaSearchRegions.find((entry) => entry.label === location),
    audience: spaSearchAudiences.find((entry) => entry.id === audienceId),
    features: featureIds.map((id) => spaLandings.find((entry) => entry.id === id)).filter((entry): entry is SpaLanding => Boolean(entry)),
  };
}

export function spaSearchHref(state: SpaSearchState) {
  if (!state.region && !state.audience && state.features.length === 1) return spaLandingHref(state.features[0]);
  const segments = [state.region?.slug, state.audience?.slug, ...state.features.map((entry) => entry.slug)].filter(Boolean);
  return segments.length ? `/spas/search/${segments.join("/")}` : "/spas";
}

export function spaSearchTitle(state: SpaSearchState) {
  const audience = state.audience ? ` ${state.audience.title}` : "";
  const region = state.region ? ` ב${state.region.label}` : " בישראל";
  const features = state.features.length ? ` עם ${state.features.map((entry) => entry.label).join(" ו")}` : "";
  return `ספא${audience}${region}${features}`;
}

export function spaSearchDescription(state: SpaSearchState) {
  const title = spaSearchTitle(state);
  return `${title}, עם חבילות וטיפולים מאומתים, פרטי מקום ברורים ואפשרות להמשיך לבקשת הזמנה באתר.`;
}

export function spaItemMatchesSearch(item: DiscoveryItem, state: SpaSearchState) {
  if (state.region && !matchesSearchLocation(item, state.region.label)) return false;
  if (state.features.some((feature) => !spaItemMatches(item, feature))) return false;
  if (state.audience) {
    const packages = getSpaDetails(item.id)?.packages || [];
    if (!packages.some((entry) => entry.audience === state.audience?.sourceAudience)) return false;
  }
  return true;
}

export function indexableSpaSearchStates(items: DiscoveryItem[]) {
  const candidates: SpaSearchState[] = [];
  spaSearchRegions.forEach((region) => {
    candidates.push({ region, features: [] });
    spaSearchAudiences.forEach((audience) => {
      candidates.push({ region, audience, features: [] });
      spaLandings.forEach((feature) => candidates.push({ region, audience, features: [feature] }));
    });
    spaLandings.forEach((feature) => candidates.push({ region, features: [feature] }));
  });
  spaSearchAudiences.forEach((audience) => candidates.push({ audience, features: [] }));
  return candidates.filter((state) => items.filter((item) => spaItemMatchesSearch(item, state)).length > 0);
}
