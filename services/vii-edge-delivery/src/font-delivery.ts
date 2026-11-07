const PUBLIC_FONT_PATHS = new Set([
  "/fonts/rubik/rubik-arabic-v31.woff2",
  "/fonts/rubik/rubik-cyrillic-ext-v31.woff2",
  "/fonts/rubik/rubik-cyrillic-v31.woff2",
  "/fonts/rubik/rubik-hebrew-v31.woff2",
  "/fonts/rubik/rubik-latin-ext-v31.woff2",
  "/fonts/rubik/rubik-latin-v31.woff2",
]);

export function isPublicRubikFont(request: Request, url = new URL(request.url)) {
  return url.hostname === "vii.spaplus.co"
    && (request.method === "GET" || request.method === "HEAD")
    && PUBLIC_FONT_PATHS.has(url.pathname);
}

export function deliverPublicRubikFont(request: Request, response: Response) {
  if (!isPublicRubikFont(request) || response.status < 200 || response.status >= 300) return response;
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "font/woff2");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
