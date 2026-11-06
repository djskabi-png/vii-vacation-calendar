import inventory from "../data/legacy-redirect-inventory.json" with { type: "json" };
import {canonicalLegacyTarget,legacySearchStateKeys as searchStateKeys} from './legacy-target-policy.ts';

export type LegacyDisposition = { status: 301; target: string } | { status: 410 };

const redirects = inventory.redirects as Record<string, string>;
const gone = new Set(inventory.gone as string[]);
const legacyPriceKeys = new Set(["price", "minPrice", "maxPrice"]);

const reviewedLegacyCanonicalRedirects: Record<string, string> = {
  "/s/even_menahem/15220": "/search/vacations/even-menahem-15220-private-covered-heated-pool",
  "/s/israel/178087": "/search/vacations/israel-178087-valentines-day",
  "/guesthouse_events": "/events/place/event-812",
  "/sol-_events_and_parties": "/events/place/event-871",
  "/willig_bar_events": "/events/place/event-930",
  "/sunset_events": "/events/place/event-2524",
};

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
  let target = redirects[exact] || redirects[path] || reviewedLegacyCanonicalRedirects[path];
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
  if (target) return {status:301,target:canonicalLegacyTarget(url,target)};
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
