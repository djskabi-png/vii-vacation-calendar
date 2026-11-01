export function requestOriginMatches(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let originUrl: URL;
  try { originUrl = new URL(origin); } catch { return false; }
  const direct = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    || request.headers.get("host")?.trim()
    || direct.host;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol ? `${forwardedProtocol}:` : direct.protocol;
  return originUrl.origin === direct.origin || (originUrl.host === host && originUrl.protocol === protocol);
}
