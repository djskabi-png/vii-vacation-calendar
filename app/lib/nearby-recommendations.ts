import { distanceKm, nearbyPlacesForSelection, type CoordinatePlace, type PublicGeographyNode } from "./geography-search.ts";

// Existing coarse region centers used by TrailMap. They are NOT trail locations.
export const nearbyRegionCenters: Record<string, { lat: number; lng: number }> = {
  "צפון": { lat: 33.02, lng: 35.38 }, "כנרת": { lat: 32.79, lng: 35.54 },
  "חיפה": { lat: 32.79, lng: 35.02 }, "מרכז": { lat: 32.12, lng: 34.93 },
  "תל אביב": { lat: 32.08, lng: 34.78 }, "דרום ונגב": { lat: 30.82, lng: 34.79 },
  "ירושלים": { lat: 31.78, lng: 35.17 }, "אילת והסביבה": { lat: 29.56, lng: 34.95 },
};

export const nearbyRecommendationCopy = {
  he: { places: "המקומות מסודרים לפי המיקום הזמין, מהקרוב לרחוק. המיקום עשוי לייצג את מרכז היישוב.", expanded: "אין מספיק מקומות בסביבה הקרובה, ולכן הוספנו גם אפשרויות מהאזור הרחב יותר.", regional: "ההצעות מבוססות על שיוך אזורי. אין כרגע מיקום מדויק שמאפשר להשוות את כל המרחקים.", trails: "מסלולים מהאזור ומאזורים סמוכים, לפי שיוך אזורי ולא לפי מרחק מדויק לנקודת ההתחלה." },
  en: { places: "Places are ordered using the available location, nearest first. A location may represent a town center.", expanded: "There are fewer options nearby, so we have also included places in the wider area.", regional: "These suggestions use regional information. Exact locations are not available for every distance comparison.", trails: "Trails in this region and neighboring regions, ranked by area rather than exact distance to the trailhead." },
  ru: { places: "Места расположены по доступным данным о местоположении, начиная с ближайших. Точка может обозначать центр населённого пункта.", expanded: "Рядом мало вариантов, поэтому мы добавили места в более широком районе.", regional: "Рекомендации основаны на регионе. Точные координаты доступны не для всех мест.", trails: "Маршруты в этом и соседних регионах. Порядок учитывает район, а не точное расстояние до начала маршрута." },
  fr: { places: "Les lieux sont classés du plus proche au plus éloigné selon les positions disponibles. Une position peut représenter le centre d'une ville.", expanded: "Il y a peu de choix à proximité. Nous avons donc ajouté des lieux dans un secteur plus large.", regional: "Ces suggestions se fondent sur la région. Les positions exactes ne sont pas disponibles pour toutes les comparaisons.", trails: "Des itinéraires dans cette région et les régions voisines, classés par secteur plutôt que par distance exacte au départ." },
};

const text = (value?: string) => (value || "").trim().replace(/[־–-]/g, " ");
export function completeNearbyResults<T>(exact: readonly T[], nearby: readonly T[], key: (item: T) => string, minimum = 3): T[] {
  const seen = new Set<string>();
  const result = exact.filter((item) => !seen.has(key(item)) && !!seen.add(key(item)));
  if (result.length >= minimum) return result;
  for (const item of nearby) {
    if (seen.has(key(item))) continue;
    seen.add(key(item));
    result.push(item);
    if (result.length >= minimum) break;
  }
  return result;
}

export function nearbyRegion(value?: string): string | null {
  const label = text(value);
  if (!label) return null;
  if (nearbyRegionCenters[label]) return label;
  if (/אילת|ערבה דרומית/.test(label)) return "אילת והסביבה";
  if (/כנרת|טבריה|בית צידה/.test(label)) return "כנרת";
  if (/חיפה|כרמל/.test(label)) return "חיפה";
  if (/תל אביב|גוש דן/.test(label)) return "תל אביב";
  if (/ירושלים|הרי יהודה/.test(label)) return "ירושלים";
  if (/דרום|נגב|ערבה|ים המלח|אזור באר שבע/.test(label)) return "דרום ונגב";
  if (/צפון|גליל|גולן|חרמון/.test(label)) return "צפון";
  if (/מרכז|שרון|שפלה|מישור החוף/.test(label)) return "מרכז";
  return null;
}

function exactPoint(place: CoordinatePlace) {
  return Number.isFinite(place.lat) && Number.isFinite(place.lng)
    && Math.abs(place.lat!) <= 90 && Math.abs(place.lng!) <= 180
    ? { lat: place.lat!, lng: place.lng! } : null;
}
export function nearbyPoint(place: CoordinatePlace) {
  const exact = exactPoint(place);
  const region = nearbyRegion(place.area) || nearbyRegion(place.location);
  return exact || (region ? nearbyRegionCenters[region] : null);
}

/** Search origins use the authoritative city hierarchy before any coarse fallback. */
export function nearbySearchRecommendations<T extends CoordinatePlace>(
  pool: readonly T[], selection: string, nodes: readonly PublicGeographyNode[],
  options: { key: (item: T) => string; origin?: CoordinatePlace },
): T[] {
  const managed = nearbyPlacesForSelection(pool, nodes, selection,
    { limit: 12, maximumDistanceKm: 100, minimumResults: 3 });
  if (managed.length) return managed.map((candidate) => candidate.place);
  const origin = options.origin || { location: selection, area: selection };
  // An unknown city is not a geographic anchor. Never fill it in catalog order.
  if (!nearbyPoint(origin)) return [];
  return nearbyRecommendations(pool, origin, { key: options.key, limit: 12 }).items;
}

/** Only geography is relaxed. Callers must supply their already eligible public pool. */
export function nearbyRecommendations<T extends CoordinatePlace>(
  pool: readonly T[], origin: CoordinatePlace,
  options: { key: (item: T) => string; exclude?: string; limit?: number; minimum?: number; radiusKm?: number },
) {
  const limit = Math.max(0, Math.floor(options.limit ?? 6));
  const minimum = Math.min(limit, Math.max(0, Math.floor(options.minimum ?? 3)));
  const radius = options.radiusKm ?? 35;
  const point = nearbyPoint(origin);
  const exactOrigin = exactPoint(origin);
  const originRegion = nearbyRegion(origin.area) || nearbyRegion(origin.location);
  const seen = new Set<string>();
  const ranked = pool.flatMap((item, index) => {
    const key = options.key(item);
    if (!key || key === options.exclude || seen.has(key)) return [];
    seen.add(key);
    const target = nearbyPoint(item);
    const exact = exactOrigin && exactPoint(item);
    const distance = point && target ? distanceKm(point, target) : Infinity;
    const sameLocation = !!text(origin.location) && text(origin.location) === text(item.location);
    const sameRegion = !!originRegion && originRegion === (nearbyRegion(item.area) || nearbyRegion(item.location));
    const local = exact ? distance <= radius : sameLocation || sameRegion;
    return [{ item, distance, local, index }];
  }).sort((a, b) => Number(b.local) - Number(a.local) || a.distance - b.distance || a.index - b.index);
  const localCount = ranked.filter((entry) => entry.local).length;
  const amount = !point ? Math.min(limit, ranked.length)
    : localCount >= minimum ? Math.min(limit, localCount) : Math.min(ranked.length, minimum);
  const selected = ranked.slice(0, amount);
  return { items: selected.map((entry) => entry.item), expanded: selected.some((entry) => !entry.local),
    regionalOnly: !exactOrigin || selected.some((entry) => !exactPoint(entry.item)), originKnown: !!point };
}
