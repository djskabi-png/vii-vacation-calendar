import type { DiscoveryItem } from "./world-data";
import { matchesSearchLocation } from "./search-taxonomy.ts";
import { canonicalSearchLocation } from "../lib/geographic-names.ts";
import { getSpaLanding, spaItemMatches, spaLandingHref, spaLandings, type SpaLanding } from "./spa-landings.ts";

export const spaSearchRegions = [
  { slug: "north", label: "צפון" },
  { slug: "haifa", label: "חיפה" },
  { slug: "haifa-carmel", label: "חיפה והכרמל" },
  { slug: "kinneret", label: "כנרת" },
  { slug: "center", label: "מרכז" },
  { slug: "tel-aviv", label: "תל אביב" },
  { slug: "tel-aviv-area", label: "תל אביב וגוש דן" },
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
export type SpaSearchLanguage = "he" | "en" | "ru" | "fr";

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
    region: spaSearchRegions.find((entry) => entry.label === canonicalSearchLocation(location)),
    audience: spaSearchAudiences.find((entry) => entry.id === audienceId),
    features: featureIds.map((id) => spaLandings.find((entry) => entry.id === id)).filter((entry): entry is SpaLanding => Boolean(entry)),
  };
}

export function spaSearchHref(state: SpaSearchState) {
  if (!state.region && !state.audience && state.features.length === 1) return spaLandingHref(state.features[0]);
  const segments = [state.region?.slug, state.audience?.slug, ...state.features.map((entry) => entry.slug)].filter(Boolean);
  return segments.length ? `/spas/search/${segments.join("/")}` : "/spas";
}

export function spaBreadcrumbForLocation(area: string, location?: string) {
  const candidate = [area, location]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value && value !== "הכל" && value !== "כל הארץ"));
  if (!candidate) return { name: "בתי ספא", path: "/spas" };
  const state = spaSearchStateFromValues(candidate);
  return state.region
    ? { name: `ספא ב${state.region.label}`, path: spaSearchHref(state) }
    : { name: `ספא ב${canonicalSearchLocation(candidate)}`, path: `/spas?location=${encodeURIComponent(canonicalSearchLocation(candidate))}` };
}

const localizedRegions: Record<Exclude<SpaSearchLanguage, "he">, Record<string, string>> = {
  en: { north: "Northern Israel", haifa: "Haifa", "haifa-carmel": "Haifa and Carmel", kinneret: "the Sea of Galilee", center: "Central Israel", "tel-aviv": "Tel Aviv", "tel-aviv-area": "Tel Aviv and Gush Dan", jerusalem: "Jerusalem", south: "Southern Israel", eilat: "Eilat" },
  fr: { north: "nord d’Israël", haifa: "Haïfa", "haifa-carmel": "Haïfa et Carmel", kinneret: "lac de Tibériade", center: "centre d’Israël", "tel-aviv": "Tel-Aviv", "tel-aviv-area": "Tel-Aviv et Gush Dan", jerusalem: "Jérusalem", south: "sud d’Israël", eilat: "Eilat" },
  ru: { north: "северной части Израиля", haifa: "Хайфе", "haifa-carmel": "Хайфе и районе Кармеля", kinneret: "районе Кинерета", center: "центральной части Израиля", "tel-aviv": "Тель-Авиве", "tel-aviv-area": "Тель-Авиве и Гуш-Дане", jerusalem: "Иерусалиме", south: "южной части Израиля", eilat: "Эйлате" },
};

const localizedAudiences: Record<Exclude<SpaSearchLanguage, "he">, Record<SpaSearchAudienceId, string>> = {
  en: { single: "for one", couple: "for couples", group: "for groups", "day-pass": "for a spa day" },
  fr: { single: "pour une personne", couple: "pour les couples", group: "pour les groupes", "day-pass": "pour une journée bien-être" },
  ru: { single: "для одного", couple: "для пар", group: "для групп", "day-pass": "на спа-день" },
};

const localizedFeatures: Record<Exclude<SpaSearchLanguage, "he">, Record<string, string>> = {
  en: { hotel: "hotel spa", boutique: "boutique or private spa", pool: "a pool", jacuzzi: "a Jacuzzi", sauna: "a sauna", gym: "a gym", couples: "a couples package", "day-pass": "a day package", meal: "a meal package" },
  fr: { hotel: "spa d’hôtel", boutique: "spa boutique ou privé", pool: "piscine", jacuzzi: "jacuzzi", sauna: "sauna", gym: "salle de sport", couples: "formule en couple", "day-pass": "formule journée", meal: "formule avec repas" },
  ru: { hotel: "спа-отелем", boutique: "бутик-спа или частным спа", pool: "бассейном", jacuzzi: "джакузи", sauna: "сауной", gym: "тренажёрным залом", couples: "пакетом для пары", "day-pass": "дневным пакетом", meal: "пакетом с питанием" },
};

export function spaSearchTitle(state: SpaSearchState, language: SpaSearchLanguage = "he") {
  if (language !== "he") {
    const audience = state.audience ? localizedAudiences[language][state.audience.id] : "";
    const region = state.region ? localizedRegions[language][state.region.slug] : language === "en" ? "Israel" : language === "fr" ? "Israël" : "Израиле";
    const featureJoiner = language === "fr" ? " et " : language === "ru" ? " и " : " and ";
    const features = state.features.map((entry) => localizedFeatures[language][entry.id]).join(featureJoiner);
    if (language === "en") return `Spa${audience ? ` ${audience}` : ""} in ${region}${features ? ` with ${features}` : ""}`;
    if (language === "fr") return `Spa${audience ? ` ${audience}` : ""} en ${region}${features ? ` avec ${features}` : ""}`;
    return `Спа${audience ? ` ${audience}` : ""} в ${region}${features ? ` с ${features}` : ""}`;
  }
  const audience = state.audience ? ` ${state.audience.title}` : "";
  const region = state.region ? ` ב${state.region.label}` : " בישראל";
  const features = state.features.length ? ` עם ${state.features.map((entry) => entry.label).join(" ו")}` : "";
  return `ספא${audience}${region}${features}`;
}

export function spaSearchDescription(state: SpaSearchState, language: SpaSearchLanguage = "he") {
  const title = spaSearchTitle(state, language);
  if (language === "en") return `${title}, with verified packages and treatments, clear venue details and a simple way to request a booking.`;
  if (language === "fr") return `${title}, avec des formules et soins vérifiés, des informations claires et un parcours simple pour demander une réservation.`;
  if (language === "ru") return `${title}, с проверенными пакетами и процедурами, понятной информацией и удобным переходом к запросу на бронирование.`;
  return `${title}, עם חבילות וטיפולים מאומתים, פרטי מקום ברורים ואפשרות להמשיך לבקשת הזמנה באתר.`;
}

// SEO and structured data receive the same Hebrew semantic source as the UI.
// Parse only known regions, audiences and features, never translate arbitrary
// business names or infer an unsupported search state.
export function localizedSpaSearchSource(value: string, language: SpaSearchLanguage): string | undefined {
  const descriptionSuffix = ", עם חבילות וטיפולים מאומתים, פרטי מקום ברורים ואפשרות להמשיך לבקשת הזמנה באתר.";
  const description = value.endsWith(descriptionSuffix);
  const title = description ? value.slice(0, -descriptionSuffix.length) : value;
  const prefix = title.match(/^ספא(?: (ליחיד|לזוג|לקבוצה|ליום כיף))? ב(.+)$/);
  if (!prefix) return undefined;
  const region = spaSearchRegions.find((entry) => prefix[2] === entry.label || prefix[2].startsWith(`${entry.label} עם `));
  if (!region) return undefined;
  const featureText = prefix[2].slice(region.label.length);
  const labels = featureText ? featureText.slice(" עם ".length).split(" ו") : [];
  const features = labels.map((label) => spaLandings.find((entry) => entry.label === label));
  if (features.some((entry) => !entry)) return undefined;
  const audience = prefix[1] ? spaSearchAudiences.find((entry) => entry.title === prefix[1]) : undefined;
  const state: SpaSearchState = { region, audience, features: features as SpaLanding[] };
  return description ? spaSearchDescription(state, language) : spaSearchTitle(state, language);
}

export function spaItemMatchesSearch(item: DiscoveryItem, state: SpaSearchState) {
  if (state.region && !matchesSearchLocation(item, state.region.label)) return false;
  if (state.features.some((feature) => !spaItemMatches(item, feature))) return false;
  if (state.audience) {
    const audienceFeature = state.audience.sourceAudience === "זוג" ? "חבילות זוגיות"
      : state.audience.sourceAudience === "יחיד" ? "חבילות ליחיד"
      : state.audience.sourceAudience === "קבוצה" ? "חבילות לקבוצות" : "חבילות יום כיף";
    if (!item.features.includes(audienceFeature)) return false;
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
