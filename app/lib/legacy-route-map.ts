import inventory from "../data/legacy-redirect-inventory.json" with { type: "json" };

export type LegacyDisposition = { status: 301; target: string } | { status: 410 };

const redirects = inventory.redirects as Record<string, string>;
const gone = new Set(inventory.gone as string[]);

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
  const target = redirects[exact] || redirects[path];
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
