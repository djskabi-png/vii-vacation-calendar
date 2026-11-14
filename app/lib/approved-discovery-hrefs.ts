const exactQueryDestinations = new Map<string, string>([
  ["/events/search?eventType=יום הולדת", "/search/events/birthday-venues"],
  ["/events/search?eventType=ימי הולדת", "/search/events/birthday-venues"],
  ["/events/search?eventType=אירוע משפחתי", "/search/events/family-events"],
  ["/events/search?eventType=אירועים משפחתיים", "/search/events/family-events"],
  ["/events/search?eventType=אירועי חברה", "/search/events/corporate-events"],
  ["/events/search?guests=100", "/search/events/large-events-over-100"],
  ["/events/search?noise=1", "/search/events/no-noise-limit"],
  ["/events/search?type=לופט", "/search/events/israel-35aac0f1"],
  ["/events/search?type=לופטים", "/search/events/israel-35aac0f1"],
  ["/events/search?type=וילה", "/search/events/israel-84415b1f"],
  ["/events/search?type=וילות", "/search/events/israel-84415b1f"],
  ["/search?location=נתניה", "/search/vacations/netanya-11266-7a5b7295"],
  ["/trails?area=צפון", "/trails/explore/north"],
  ["/trails?area=מרכז", "/trails/explore/center"],
  ["/trails?area=דרום ונגב", "/trails/explore/south"],
  ["/attractions?area=צפון", "/attractions/explore/north"],
  ["/attractions?area=מרכז ותל אביב", "/attractions/explore/center"],
  ["/attractions?area=דרום ונגב", "/attractions/explore/south"],
]);

export const approvedEventDiscoveryPaths = {
  birthdays: "/search/events/birthday-venues",
  family: "/search/events/family-events",
  large: "/search/events/large-events-over-100",
  noise: "/search/events/no-noise-limit",
  corporate: "/search/events/corporate-events",
  lofts: "/search/events/israel-35aac0f1",
  villas: "/search/events/israel-84415b1f",
} as const;

export function approvedEventVenueTypeHref(type: string): string | null {
  const normalized = type.trim();
  if (/^לופטים?$/.test(normalized)) return approvedEventDiscoveryPaths.lofts;
  if (/^וילות?$/.test(normalized)) return approvedEventDiscoveryPaths.villas;
  return null;
}

function normalizedKey(url: URL) {
  const entries = [...url.searchParams.entries()].sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue));
  const query = new URLSearchParams(entries).toString();
  return decodeURIComponent(`${url.pathname}${query ? `?${query}` : ""}`.replace(/\+/g, "%20"));
}

export function normalizeApprovedDiscoveryHref(href: string): string | null {
  let url: URL;
  try { url = new URL(href, "https://vii.invalid"); } catch { return null; }
  if (url.origin !== "https://vii.invalid" || !url.pathname.startsWith("/")) return null;
  const locale = url.pathname.match(/^\/(en|fr|ru)(?=\/)/)?.[0] || "";
  if (locale) url.pathname = url.pathname.slice(locale.length) || "/";
  if (!url.search) return `${locale}${url.pathname}${url.hash}`;
  const destination = exactQueryDestinations.get(normalizedKey(url));
  return destination ? `${locale}${destination}${url.hash}` : null;
}
