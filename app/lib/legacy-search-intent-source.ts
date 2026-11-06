import legacySearchPublications from "../data/legacy-search-page-publications.json" with { type: "json" };
import { curatedVacationSearchPages } from "../data/curated-vacation-search-pages.ts";
import {completeLegacySearchFilters,completeLegacySearchSourcePath,legacyIntentStringFeatures,canonicalVacationIntentKey,type LegacySearchPage} from "./legacy-search-intent-rules.ts";

export function buildLegacyVacationIntentIndex() {
  const candidates = new Map<string, LegacySearchPage[]>();
  for (const page of [...legacySearchPublications.pages, ...curatedVacationSearchPages] as LegacySearchPage[]) {
    const filters = completeLegacySearchFilters(page);
    const features = legacyIntentStringFeatures(filters.features);
    if (!features.length) continue;
    const key = canonicalVacationIntentKey({ location: page.location, type: typeof filters.type === "string" ? filters.type : "", features });
    const rows = candidates.get(key) || [];
    rows.push(page);
    candidates.set(key, rows);
  }
  return new Map([...candidates].map(([key, pages]) => [key, pages.sort((left, right) => {
    const leftExact = Number(completeLegacySearchSourcePath(left).includes("features="));
    const rightExact = Number(completeLegacySearchSourcePath(right).includes("features="));
    return rightExact - leftExact || left.canonicalPath.localeCompare(right.canonicalPath);
  })[0].canonicalPath]));
}
