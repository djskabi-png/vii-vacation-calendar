// Keep old managed homepage links compatible with the current search contract.
// Do not rewrite other worlds, arbitrary features or explicit pool selections.
export function normalizeHomepageSearchHref(href: string): string {
  if (!/^\/(?:(?:en|fr|ru)\/)?search\/?\?/.test(href)) return href;
  const url = new URL(href, "https://vii.invalid");
  const legacy = url.searchParams.getAll("feature");
  if (legacy.length !== 1 || legacy[0] !== "בריכה") return href;
  url.searchParams.delete("feature");
  if (!url.searchParams.has("pool")) url.searchParams.set("pool", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function normalizeHomepageItems<T extends { href: string }>(items: T[]): T[] {
  const nearbyRoutes:Record<string,string>={"/search":"/vacations/near-me","/spas":"/spas/near-me","/events/search":"/events/near-me","/hourly":"/hourly/near-me","/trails":"/trails/near-me","/attractions":"/attractions/near-me"};
  return items.map((item) => {
    let href=normalizeHomepageSearchHref(item.href);
    if ((item as T & {action?:string}).action === "nearby") {
      const url=new URL(href,"https://vii.invalid");
      const locale=url.pathname.match(/^\/(en|ru|fr)(?=\/)/)?.[0] || "";
      const path=url.pathname.slice(locale.length).replace(/\/$/,"");
      if(nearbyRoutes[path] && [...url.searchParams.keys()].every(key=>key==="sort") && url.searchParams.get("sort")==="nearest") href=`${locale}${nearbyRoutes[path]}${url.hash}`;
    }
    return {...item,href};
  });
}

export function isManagedSearchListAttribute(key: string) {
  return /^homePopularSearches(?:Spa|Events|Hourly|Providers|Trails|Attractions|Corporate)?$/.test(key)
    || ["homeCitySearches", "homeTypeSearches"].includes(key);
}
export function validManagedSearchList(value: string) {
  if (value.length > 24_000) return false;
  try {
    const rows: unknown = JSON.parse(value);
    if (!Array.isArray(rows) || rows.length > 40) return false;
    const ids = new Set<string>();
    return rows.every(row => {
      if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id || ids.has(row.id)) return false;
      ids.add(row.id);
      return typeof row.label === "string" && row.label.trim().length > 0 && row.label.length <= 70
        && typeof row.href === "string" && row.href.length <= 240 && /^\/(?!\/)/.test(row.href) && !/[\\\u0000-\u001f]/.test(row.href)
        && typeof row.image === "string" && row.image.length <= 300 && /^\/(?!\/)/.test(row.image)
        && (row.action === undefined || row.action === "" || row.action === "nearby");
    });
  } catch { return false; }
}
