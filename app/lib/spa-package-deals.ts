import type { SpaPlusSite } from "../data/spaplus";
import { eventDealDate } from "./event-deal-dates.ts";
export type SpaDayAvailability = { siteID: number; date: string; available: number };
export type SpaDealAudience = "single" | "couple" | "group";
export type SpaDealSite = Pick<SpaPlusSite, "id" | "title" | "city" | "image"> & { titleEN?:string|null; packages: SpaPlusSite["packages"] };
export type SpaPackageDeal = { siteId: number; packageId: number; siteName: string; siteNameEN:string; city: string; title: string; price: number; people: number | null; durationMinutes: number | null; image: string; href: string };
export function validSpaDealDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function spaPackageDealHref(siteId: number, packageId: number, date: string) {
  return `/discover/place/spa-${siteId}?date=${date}&package=${packageId}#spa-package-${packageId}`;
}
export function millisecondsToNextIsraelDay(now = new Date()) {
  const day = eventDealDate(0, now);
  let low = 0, high = 27 * 60 * 60 * 1000;
  while (high - low > 1000) {
    const middle = Math.floor((low + high) / 2);
    if (eventDealDate(0, new Date(now.getTime() + middle)) === day) low = middle;
    else high = middle;
  }
  return high + 25;
}
// Site/day availability is a discovery signal, not a package/date quote.
export function selectSpaPackageDeals(sites: SpaDealSite[], availability: SpaDayAvailability[], date: string, audience: SpaDealAudience): SpaPackageDeal[] {
  if (!validSpaDealDate(date)) return [];
  const availableSites = new Set(availability.filter(row => row.date === date && Number.isFinite(row.available) && row.available > 0).map(row => row.siteID));
  const seen = new Set<string>();
  return sites.flatMap(site => {
    if (!Number.isSafeInteger(site.id) || site.id <= 0 || !availableSites.has(site.id)) return [];
    return site.packages.flatMap(pack => {
      const key = `${site.id}:${pack.id}`;
      const matches = audience === "group" ? pack.group || (pack.people ?? 0) >= 3 : !pack.group && pack.people === (audience === "single" ? 1 : 2);
      const image = pack.image || site.image || "";
      if (!matches || !Number.isSafeInteger(pack.id) || pack.id <= 0 || !Number.isFinite(pack.price) || pack.price <= 0 || !pack.title?.trim() || !/^https:\/\/www\.spaplus\.co\.il\/gallery\//.test(image) || seen.has(key)) return [];
      seen.add(key);
      return [{ siteId: site.id, packageId: pack.id, siteName: site.title, siteNameEN:site.titleEN || "", city: site.city, title: pack.title, price: pack.price, people: pack.people, durationMinutes: pack.durationMinutes || null, image, href: spaPackageDealHref(site.id, pack.id, date) }];
    });
  }).sort((a, b) => a.price - b.price || a.siteId - b.siteId || a.packageId - b.packageId);
}

export function selectSpaCatalogPackages(sites: SpaDealSite[], date: string, audience: SpaDealAudience): SpaPackageDeal[] {
  if (!validSpaDealDate(date)) return [];
  const seen = new Set<string>();
  return sites.flatMap(site => site.packages.flatMap(pack => {
    const key = `${site.id}:${pack.id}`;
    const matches = audience === "group" ? pack.group || (pack.people ?? 0) >= 3 : !pack.group && pack.people === (audience === "single" ? 1 : 2);
    const image = pack.image || site.image || "";
    if (!matches || !Number.isSafeInteger(site.id) || site.id <= 0 || !Number.isSafeInteger(pack.id) || pack.id <= 0
      || !Number.isFinite(pack.price) || pack.price <= 0 || !pack.title?.trim()
      || !/^https:\/\/www\.spaplus\.co\.il\/gallery\//.test(image) || seen.has(key)) return [];
    seen.add(key);
    return [{ siteId: site.id, packageId: pack.id, siteName: site.title, siteNameEN: site.titleEN || "", city: site.city,
      title: pack.title, price: pack.price, people: pack.people, durationMinutes: pack.durationMinutes || null, image,
      href: spaPackageDealHref(site.id, pack.id, date) }];
  })).sort((a, b) => a.price - b.price || a.siteId - b.siteId || a.packageId - b.packageId);
}
