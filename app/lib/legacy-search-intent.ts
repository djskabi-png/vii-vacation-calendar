import legacySearchPublications from "../data/legacy-search-page-publications.json" with { type: "json" };
import { curatedVacationSearchPages } from "../data/curated-vacation-search-pages.ts";

type SearchFilters = Record<string, string | number | boolean>;
type LegacySearchPage = {
  canonicalPath: string;
  sourcePath: string;
  location: string;
  title: string;
  h1: string;
  metaTitle: string;
  filters?: SearchFilters;
};

const semanticFeatureRules = [
  { id: "covered-heated-pool", pattern: /בריכ(?:ת שחייה|ת שחיה|ה)?[^.]{0,24}מחוממת[^.]{0,18}מקורה|בריכ(?:ת שחייה|ת שחיה|ה)?[^.]{0,24}מקורה[^.]{0,18}מחוממת/ },
  { id: "private-pool", pattern: /בריכ(?:ת שחייה|ת שחיה|ה)?[^.]{0,22}פרטית|בריכה פרטית/ },
  { id: "heated-pool", pattern: /בריכ(?:ת שחייה|ת שחיה|ה)?[^.]{0,22}מחוממת/ },
  { id: "fenced-pool", pattern: /בריכ(?:ת שחייה|ת שחיה|ה)?[^.]{0,22}מגודרת/ },
  { id: "children-pool", pattern: /בריכת ילדים/ },
  { id: "jacuzzi", pattern: /ג[׳']קוזי/ },
  { id: "accessible", pattern: /נגיש(?:ות|ים|ות לנכים)?/ },
  { id: "families", pattern: /למשפחות|משפחתי/ },
  { id: "couples", pattern: /לזוגות|זוגי/ },
] as const;

function normalizedLocation(value: string | null | undefined) {
  const normalized = (value || "").replace(/\+/g, " ").trim();
  return /^(?:הכל|כל הארץ|ישראל)$/.test(normalized) ? "כל הארץ" : normalized;
}

function normalizedType(value: string | null | undefined) {
  const normalized = (value || "").trim();
  const aliases: Record<string, string> = {
    צימר: "צימרים", וילה: "וילות", סוויטה: "סוויטות", "דירת נופש": "דירות נופש",
    "בקתת עץ": "בקתות עץ", מערה: "מערות", "צימר מאבן": "צימרים מאבן",
    "אוהל אינדיאני": "אוהלים אינדיאנים", "מתחם אירוח": "מתחמי אירוח",
  };
  return aliases[normalized] || normalized;
}

function stringFeatures(value: unknown) {
  return typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function semanticFeatures(page: LegacySearchPage) {
  const text = `${page.title} ${page.h1} ${page.metaTitle}`;
  const explicit = stringFeatures(page.filters?.features);
  const inferred = semanticFeatureRules.filter((rule) => rule.pattern.test(text)).map((rule) => rule.id);
  const qualifiedPool = inferred.some((id) => ["covered-heated-pool", "private-pool", "heated-pool", "fenced-pool", "children-pool"].includes(id));
  const genericPool = !qualifiedPool && /(?:עם|כולל(?:ת|ים)?)\s+בריכ(?:ה|ת שחייה|ת שחיה)(?![^.]{0,22}(?:פרטית|מחוממת|מקורה|מגודרת|ילדים))/.test(text) ? ["pool"] : [];
  return [...new Set([...explicit, ...inferred, ...genericPool])].sort();
}

export function completeLegacySearchFilters(page: LegacySearchPage): SearchFilters {
  const source = new URL(page.sourcePath, "https://vii.spaplus.co");
  const filters: SearchFilters = { ...(page.filters || {}) };
  const sourceType = source.searchParams.get("type");
  if (!filters.type && sourceType) filters.type = sourceType;
  const features = semanticFeatures(page);
  if (features.length) filters.features = features.join(",");
  return filters;
}

export function completeLegacySearchSourcePath(page: LegacySearchPage) {
  const source = new URL(page.sourcePath, "https://vii.spaplus.co");
  const filters = completeLegacySearchFilters(page);
  if (typeof filters.type === "string") source.searchParams.set("type", filters.type);
  if (typeof filters.features === "string") source.searchParams.set("features", filters.features);
  return `${source.pathname}${source.search}`;
}

type VacationIntent = { location?: string | null; type?: string | null; features?: readonly string[] };

export function semanticVacationFeaturesFromSearchParams(params: URLSearchParams) {
  return [...new Set([
    ...(params.get("pool") === "1" ? ["pool"] : []),
    ...(params.get("accessible") === "1" ? ["accessible"] : []),
    ...(params.get("spa") === "1" ? ["spa"] : []),
    ...(params.get("features") || "").split(",").filter(Boolean),
  ])].sort();
}

export function vacationSearchHasTransactionalState(params: URLSearchParams) {
  return ["from", "till", "dates", "guests", "adults", "children", "rooms", "bedrooms", "minPrice", "maxPrice", "sort", "online", "whole"]
    .some((key) => params.has(key));
}

function intentKey(intent: VacationIntent) {
  return JSON.stringify({
    location: normalizedLocation(intent.location),
    type: normalizedType(intent.type),
    features: [...new Set(intent.features || [])].sort(),
  });
}

const canonicalVacationIntents = (() => {
  const candidates = new Map<string, LegacySearchPage[]>();
  for (const page of [...legacySearchPublications.pages, ...curatedVacationSearchPages] as LegacySearchPage[]) {
    const filters = completeLegacySearchFilters(page);
    const features = stringFeatures(filters.features);
    if (!features.length) continue;
    const key = intentKey({ location: page.location, type: typeof filters.type === "string" ? filters.type : "", features });
    const rows = candidates.get(key) || [];
    rows.push(page);
    candidates.set(key, rows);
  }
  return new Map([...candidates].map(([key, pages]) => [key, pages.sort((left, right) => {
    const leftExact = Number(completeLegacySearchSourcePath(left).includes("features="));
    const rightExact = Number(completeLegacySearchSourcePath(right).includes("features="));
    return rightExact - leftExact || left.canonicalPath.localeCompare(right.canonicalPath);
  })[0].canonicalPath]));
})();

export function canonicalLegacyVacationSearchPath(intent: VacationIntent) {
  if (!intent.features?.length) return null;
  return canonicalVacationIntents.get(intentKey(intent)) || null;
}

export function legacyCanonicalIntentCount() {
  return canonicalVacationIntents.size;
}
