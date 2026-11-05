import inventory from "../data/legacy-redirect-inventory.json" with { type: "json" };

export type LegacyDisposition = { status: 301; target: string } | { status: 410 };

const redirects = inventory.redirects as Record<string, string>;
const gone = new Set(inventory.gone as string[]);
const searchStateKeys = ["from", "till", "to", "dates", "guests", "adults", "children", "infants", "pets", "rooms", "roomID", "price", "minPrice", "maxPrice", "sort"];
const legacyPriceKeys = new Set(["price", "minPrice", "maxPrice"]);

export function normalizedLegacySource(input: URL | string) {
  const url = input instanceof URL ? input : new URL(input, "https://www.vii.co.il");
  const pathname = (url.pathname.replace(/\/+$/, "") || "/").toLowerCase();
  if (!url.search) return pathname;
  const search = new URLSearchParams(url.search);
  search.sort();
  return `${pathname}?${search.toString()}`;
}

export function legacyDisposition(input: URL | string): LegacyDisposition | null {
  const url = input instanceof URL ? input : new URL(input, "https://www.vii.co.il");
  const exact = normalizedLegacySource(url);
  const path = normalizedLegacySource(url.pathname);
  let target = redirects[exact] || redirects[path];
  // Legacy search pages were published without booking state. A dated legacy
  // URL must still resolve to the same approved semantic page while retaining
  // the visitor's dates and party for the new search experience.
  if (!target && url.pathname.toLowerCase() === "/s") {
    const semantic = new URL(url);
    // A published legacy price combination is itself a registered intent.
    // Try it before treating an added price as transactional state.
    for (const key of searchStateKeys) if (!legacyPriceKeys.has(key)) semantic.searchParams.delete(key);
    target = redirects[normalizedLegacySource(semantic)];
    if (!target) {
      for (const key of legacyPriceKeys) semantic.searchParams.delete(key);
      target = redirects[normalizedLegacySource(semantic)];
    }
  }
  if (target && /^\/s(?:\/|$)/i.test(url.pathname)) {
      const destination = new URL(target, "https://vii.spaplus.co");
      for (const key of searchStateKeys) {
        const value = url.searchParams.get(key);
        if (value) destination.searchParams.set(key, value);
      }
      target = `${destination.pathname}${destination.search}`;
  }
  if (target && /^\/(?:business(?:\?|$)|events\/place\/|discover\/place\/)/.test(target)) {
    const destination = new URL(target, "https://vii.spaplus.co");
    for (const key of [...searchStateKeys, "date"]) {
      const value = url.searchParams.get(key);
      if (value) destination.searchParams.set(key, value);
    }
    target = `${destination.pathname}${destination.search}`;
  }
  if (target) return { status: 301, target };
  if (gone.has(exact) || gone.has(path)) return { status: 410 };
  return null;
}

export function legacyPlaceDestination(pathname: string) {
  const disposition = legacyDisposition(pathname);
  return disposition?.status === 301 ? disposition.target : null;
}

export function looksLikeUninventoriedLegacyPath(pathname: string) {
  const path = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  if (/^\/(?:s|events\/s)(?:\/|$)/.test(path)) return true;
  if (/^\/(?:events|rooms)\/[^/]+$/.test(path)) return true;
  return /^\/[^/.]+(?:\.html?|\.php)?$/.test(path);
}

export const legacyInventoryStats = inventory.stats;
