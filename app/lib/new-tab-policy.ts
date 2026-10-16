const businessDepthRoutes = [
  /^\/business(?:\/|$)/,
  /^\/events\/place(?:\/|$)/,
  /^\/discover\/place(?:\/|$)/,
  /^\/guides\/[^/]+(?:\/|$)/,
  /^\/trails\/(?!explore(?:\/|$))[^/]+(?:\/|$)/,
];

export function isBusinessDepthRoute(pathname: string) {
  const path = pathname.replace(/^\/(en|ru|fr)(?=\/|$)/, "") || "/";
  return businessDepthRoutes.some(pattern => pattern.test(path));
}
