import catalog from "./spaplus-catalog.json";
export { spaPlusArea } from "./spa-regions";
export { spaPlusAudience } from "./spa-audience";

export type SpaPlusSite = (typeof catalog.sites)[number] & { gallery?: string[] };
export type SpaPlusPackage = SpaPlusSite["packages"][number];

export const spaPlusSites: SpaPlusSite[] = catalog.sites;
export const spaPlusCatalogGeneratedAt = catalog.generatedAt;

export function spaPlusSiteById(id: string) {
  if (!/^spa-\d+$/.test(id)) return undefined;
  return spaPlusSites.find((site) => `spa-${site.id}` === id);
}
