import type { SearchDepthInventoryPlace } from "./search-depth-model";
import { providerTopicCategories, providerCategoryHref } from "../data/provider-categories.ts";

export type DepthWorld = "vacation" | "events" | "spa" | "hourly" | "providers" | "activities" | "trails";
export type DepthSuggestion = { label: string; params: Record<string, string | null>; path?: string; kind?: "type" | "smart" };
export const depthLocationParam = (world: DepthWorld) => world === "providers" ? "region" : world === "activities" || world === "trails" ? "area" : "location";
const allowed: Record<DepthWorld, readonly string[]> = {
  vacation: ["location", "from", "till", "dates", "guests", "adults", "children", "rooms", "type", "types", "pool", "spa", "whole", "accessible", "online", "features", "minPrice", "maxPrice", "sort"],
  events: ["location", "from", "to", "guests", "type", "eventType", "hours", "noise", "accessible", "sort"],
  spa: ["location", "spaFor", "features", "date"], hourly: ["location", "maxPrice", "features"],
  providers: ["region", "q"], activities: ["area", "type", "q"], trails: ["area", "nature", "difficulty", "q"],
};

// A detail page can carry id, source, gallery and contact state. None belongs
// in a discovery destination, and one world's filters cannot leak into another.
export function depthQuery(world: DepthWorld, query: string, updates: Record<string, string | null> = {}, location?: string) {
  const incoming = new URLSearchParams(query);
  const params = new URLSearchParams();
  for (const key of allowed[world]) { const value = incoming.get(key); if (value) params.set(key, value); }
  const locationKey = depthLocationParam(world);
  if (location && !/^(הכל|כל הארץ|all|all-country)$/i.test(location) && !params.has(locationKey)) params.set(locationKey, location);
  for (const [key, value] of Object.entries(updates)) {
    if (!allowed[world].includes(key)) continue;
    if (value === null || value === "" || value === "הכל" || value === "כל הארץ") params.delete(key);
    else params.set(key, value);
  }
  return params;
}

const unique = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value && value !== "הכל" && value !== "כל הארץ")))];
export const providerDepthRegions: readonly string[] = ["צפון", "כנרת", "חיפה", "מרכז", "תל אביב", "ירושלים", "דרום ונגב", "אילת והסביבה"];
export function providerDepthLocation(serviceAreas: string[] | undefined) {
  const regions = unique(serviceAreas || []).filter(area => providerDepthRegions.includes(area));
  return regions.length === 1 ? regions[0] : undefined;
}

export function defaultDepthSuggestions(world: DepthWorld, inventory: SearchDepthInventoryPlace[]): DepthSuggestion[] {
  const types = unique(inventory.map(item => item.type)).slice(0, 12).map((label): DepthSuggestion => ({ label, params: world === "vacation" ? { type: label, types: null } : { type: label }, kind: "type" }));
  if (world === "vacation") return [...types,
    { label: "נופש לזוג", params: { guests: "2" } }, { label: "נופש למשפחה", params: { guests: "6" } },
    { label: "נופש עם בריכה", params: { pool: "1" } }, { label: "נופש נגיש", params: { accessible: "1" } }];
  if (world === "events") return [...types, ...unique(inventory.flatMap(item => item.eventTypes || [])).slice(0, 10).map(label => ({ label, params: { eventType: label } })),
    { label: "ללא הגבלת רעש", params: { noise: "1" } }, { label: "מקומות נגישים", params: { accessible: "1" } }];
  if (world === "spa") return [
    { label: "ספא בבית מלון", params: { features: "hotel" }, kind: "type" }, { label: "ספא בוטיק או פרטי", params: { features: "boutique" }, kind: "type" },
    { label: "ספא זוגי", params: { spaFor: "couple" } }, { label: "ספא ליחיד", params: { spaFor: "single" } },
    { label: "יום כיף בספא", params: { spaFor: "day-pass" } }, { label: "ספא עם בריכה", params: { features: "pool" } },
    { label: "ספא עם ג׳קוזי", params: { features: "jacuzzi" } }, { label: "ספא עם סאונה", params: { features: "sauna" } }, { label: "חבילה עם ארוחה", params: { features: "meal" } }];
  if (world === "hourly") return [
    { label: "חדרים עם ג׳קוזי", params: { features: "jacuzzi" } }, { label: "חדרים עם בריכה", params: { features: "pool" } },
    { label: "כניסה עצמאית", params: { features: "independent" } }, { label: "חדרים עם חניה", params: { features: "parking" } },
    { label: "עד 250 ₪ לשעתיים", params: { maxPrice: "250" } }, { label: "עד 400 ₪ לשעתיים", params: { maxPrice: "400" } }];
  if (world === "providers") return providerTopicCategories.map(category => ({ label: category.label, path: providerCategoryHref(category), params: {}, kind: "type" }));
  if (world === "activities") return unique(inventory.map(item => item.type)).slice(0, 12).map(label => ({ label, params: { type: label }, kind: "type" }));
  return [
    ...unique(inventory.flatMap(item => item.nature || [])).slice(0, 14).map(label => ({ label, params: { nature: label }, kind: "type" as const })),
    ...unique(inventory.map(item => item.difficulty)).map(label => ({ label, params: { difficulty: label } })),
  ];
}

export function secondaryDepthLayers(world: DepthWorld, location: string | undefined, inventory: SearchDepthInventoryPlace[]) {
  const areas = world === "providers" ? unique(inventory.flatMap(item => item.serviceAreas || [])).filter(area => providerDepthRegions.includes(area)) : unique(inventory.map(item => item.area));
  const cities = world === "providers" ? [] : unique(inventory.filter(item => !location || item.area === location).map(item => item.location)).filter(city => city !== location).slice(0, 16);
  return { suitableRegions: areas.filter(area => area !== location).slice(0, 12), cities, additionalRegions: [] as string[], contextArea: location || "" };
}

export function depthTopicKey(label: string, world: DepthWorld, params: Record<string, string | null> = {}) {
  const text = `${label} ${Object.values(params).join(" ")}`.toLowerCase();
  for (const [key, pattern] of [
    ["pool", /בריכ|מים|נחל|כנרת|pool|water/], ["bath", /ג.?קוזי|jacuzzi/], ["heart", /זוג|רומנט|couple/],
    ["meal", /ארוח|אוכל|קייטרינג|שפים|food|meal/], ["music", /מוזיק|תקליט|music/], ["camera", /צילום|photo/],
    ["flower", /עיצוב|בלונ|פרח|design/], ["bar", /ברים|קוקטייל|bar/], ["party", /אירוע|מסיב|מופע|entertainment/],
    ["access", /נגיש|accessible/], ["parking", /חניה|parking/], ["key", /עצמאית|independent/], ["wallet", /₪|מחיר|maxprice/],
    ["heat", /סאונ|sauna/], ["forest", /יער|חורש|צפון|גליל|טבע|tree/], ["landmark", /ירושלים/],
    ["coast", /חיפה|תל אביב|חוף|שיט/], ["sun", /דרום|מדבר|נגב|אילת|יום כיף|day-pass/],
    ["mountain", /גולן|הר|מיטיבי|סלע|קניון/], ["people", /משפח|קבוצ|אורח|guests|group/],
    ["hotel", /מלון|hotel/], ["house", /ויל|צימר|בקת|סוויט|דיר|בית|בוטיק|boutique/],
    ["city", /מרכז|שרון|שפלה|עיר/],
  ] as const) if (pattern.test(text)) return key;
  return ({ vacation: "house", events: "party", spa: "spa", hourly: "clock", providers: "spark", activities: "compass", trails: "foot" } as const)[world];
}
