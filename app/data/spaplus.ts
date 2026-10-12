import catalog from "./spaplus-catalog.json";
export { spaPlusArea } from "./spa-regions";

export type SpaPlusSite = (typeof catalog.sites)[number] & { gallery?: string[] };
export type SpaPlusPackage = SpaPlusSite["packages"][number];

export const spaPlusSites: SpaPlusSite[] = catalog.sites;
export const spaPlusCatalogGeneratedAt = catalog.generatedAt;

export function spaPlusAudience(pack: SpaPlusPackage): "יחיד" | "זוג" | "קבוצה" | "יום כיף" | "לא צוין" {
  if (pack.group || (pack.people !== null && pack.people >= 3)) return "קבוצה";
  if (pack.people === 1) return "יחיד";
  if (pack.people === 2) return "זוג";
  if (/קבוצ|קבוצה/.test(pack.title)) return "קבוצה";
  if (/זוגי|זוגית/.test(pack.title)) return "זוג";
  if (/ליחיד|ליחידה/.test(pack.title)) return "יחיד";
  if (/יום כיף/.test(pack.title)) return "יום כיף";
  return "לא צוין";
}

export function spaPlusSiteById(id: string) {
  if (!/^spa-\d+$/.test(id)) return undefined;
  return spaPlusSites.find((site) => `spa-${site.id}` === id);
}
