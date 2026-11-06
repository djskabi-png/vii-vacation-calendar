import snapshot from "./supplier-legacy-links.generated.json" with {type:"json"};
type World="vacations"|"events";
export function supplierLegacySlug(id:string|undefined,world:World):string|undefined{const values=snapshot.aliases[world] as Record<string,string>;return id&&Object.hasOwn(values,id)?values[id]:undefined;}
export function unavailableLegacyPlace(id:string|undefined,world:World):{name:string;area:string}|undefined{const values=snapshot.unavailable[world] as Record<string,{name:string;area:string}>;return id&&Object.hasOwn(values,id)?values[id]:undefined;}
export function unavailableLegacySearchHref(id: string | undefined, world: "vacations" | "events") {
  const place = unavailableLegacyPlace(id, world);
  if (!place || !id) return undefined;
  const query = new URLSearchParams({ unavailable: id, location: place.area });
  return `${world === "events" ? "/events/search" : "/search"}?${query}`;
}
