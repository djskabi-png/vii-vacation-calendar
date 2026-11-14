const accommodationSearchRoots = [
  "/hospitality-complexes",
  "/indian-tents",
  "/luxury-suites",
  "/stone-zimmers",
  "/suite-complexes",
  "/vacation-apartments",
  "/vacation-caves",
  "/villas",
  "/wood-cabins",
  "/zimmers",
] as const;

function isRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}
function isSpaSearchLanding(pathname: string) {
  if (pathname === "/spas" || pathname === "/spas/near-me" || isRoute(pathname, "/spas/search")) return true;
  if (!pathname.startsWith("/spas/")) return false;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return false;
  return !["today", "tomorrow", "day"].includes(segments[1]);
}

/**
 * Header search is a fallback entry point. Pages that already own a full
 * search surface must omit it during the first render, not hide it after
 * hydration. Keep this route inventory aligned with SearchBox and
 * SpecialWorldSearch consumers.
 */
export function hasInPageSearchSurface(rawPathname: string) {
  const pathname = rawPathname !== "/" ? rawPathname.replace(/\/+$/, "") : rawPathname;

  if (pathname === "/" || isRoute(pathname, "/search")) return true;
  if (isRoute(pathname, "/vacations")) return true;
  if (accommodationSearchRoots.some((route) => isRoute(pathname, route))) return true;

  if (pathname === "/events" || pathname === "/events/near-me" || isRoute(pathname, "/events/search")) return true;
  if (isSpaSearchLanding(pathname)) return true;
  if (pathname === "/hourly" || pathname === "/hourly/near-me" || isRoute(pathname, "/hourly/search")) return true;

  if (isRoute(pathname, "/providers")) return true;
  if (pathname === "/guides") return true;
  if (pathname === "/attractions" || pathname === "/attractions/near-me" || isRoute(pathname, "/attractions/explore")) return true;
  if (pathname === "/trails" || pathname === "/trails/near-me" || isRoute(pathname, "/trails/explore")) return true;

  return false;
}
