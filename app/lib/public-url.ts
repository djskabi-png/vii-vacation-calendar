export const SITE_URL = "https://vii.spaplus.co";

export function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const [pathname, query] = normalized.split("?", 2);
  const canonicalPath = pathname === "/" ? pathname : pathname.replace(/\/$/, "");
  return `${SITE_URL}${canonicalPath}${query ? `?${query}` : ""}`;
}
