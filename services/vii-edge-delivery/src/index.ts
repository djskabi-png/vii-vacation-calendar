const ORIGIN = "https://vii-vacation-calendar.adir-naor-7510.chatgpt.site";
const EXPECTED_BUILD = "85bd2763-e953-4fba-bb88-71f1faafa510";
const EDGE_CACHE_VERSION = "v2";
const allowedQuery = new Set(["accessible", "area", "features", "flex", "from", "guests", "id", "location", "maxPrice", "minPrice", "months", "online", "period", "pool", "release", "sort", "source", "spa", "till", "to", "type", "types", "whole", "_rsc"]);
const allowedUtm = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);
const variantHeaders = ["Accept", "RSC", "Next-Router-State-Tree", "Next-Router-Prefetch", "Next-Router-Segment-Prefetch", "Next-Url", "X-Vinext-Interception-Context", "X-Vinext-Mounted-Slots", "X-Vinext-Rsc-Render-Mode"];
const maxBytes = 2 * 1024 * 1024;
const infrastructureCookies = new Set(["__cf_bm", "cf_clearance", "__cflb", "_cfuvid"]);
function infrastructureSetCookieOnly(value: string | null) {
  if (!value) return true;
  const names = [...value.matchAll(/(?:^|,\s*)([^=;,\s]+)=/g)].map((match) => match[1]);
  return names.length > 0 && names.every((name) => infrastructureCookies.has(name));
}
async function boundedBody(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return null;
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > maxBytes) return null; chunks.push(part.value); } }
  finally { reader.releaseLock(); }
  const body = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; } return body;
}
async function boundedMatch(cache: Cache, key: Request) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([cache.match(key).catch(() => undefined), new Promise<undefined>((resolve) => { timer = setTimeout(resolve, 100); })]); }
  finally { if (timer) clearTimeout(timer); }
}

function privateRequest(request: Request) {
  if (request.method !== "GET" || request.headers.has("Authorization") || request.headers.has("Next-Action") || request.headers.has("X-Server-Action")) return true;
  const cookie = request.headers.get("Cookie");
  return !!cookie?.trim();
}

function eligible(request: Request, url: URL) {
  if (privateRequest(request) || url.pathname.startsWith("/api/") || /^\/(?:admin|account|favorites|booking|handoff|join)(?:\/|$)/.test(url.pathname)) return false;
  const rsc = url.pathname.endsWith(".rsc");
  const path = (rsc ? url.pathname.slice(0, -4) || "/" : url.pathname).replace(/^\/(?:en|ru|fr)(?=\/|$)/, "") || "/";
  if (!/^\/(?:$|search(?:\/|$)|events(?:\/|$)|spas(?:\/|$)|hourly(?:\/|$)|vacations(?:\/|$)|business(?:\/|$)|holidays(?:\/|$)|providers(?:\/|$)|attractions(?:\/|$)|activities(?:\/|$)|trails(?:\/|$)|destinations(?:\/|$)|corporate(?:\/|$))/.test(path)) return false;
  if (rsc ? !(request.headers.get("Accept") || "").includes("text/x-component") : !(request.headers.get("Accept") || "").includes("text/html")) return false;
  const seen = new Set(); for (const key of url.searchParams.keys()) { if (allowedUtm.has(key)) continue; if (!allowedQuery.has(key) || seen.has(key)) return false; seen.add(key); }
  if (request.headers.get("RSC") || request.headers.get("Next-Router-State-Tree")) return rsc;
  return !rsc;
}

function keyFor(request: Request, url: URL, build: string) {
  const query = [...url.searchParams.entries()].filter(([key]) => !allowedUtm.has(key)).sort().map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  const variants = encodeURIComponent(variantHeaders.map((name) => `${name}:${request.headers.get(name) || ""}`).join("|"));
  return new Request(`${url.origin}/__vii-edge/${EDGE_CACHE_VERSION}/${encodeURIComponent(url.pathname)}?${query}${query ? "&" : ""}__build=${encodeURIComponent(build)}&__variants=${variants}`);
}

export default { async fetch(request: Request, env: { ORIGIN?: string; EXPECTED_BUILD?: string }, ctx: ExecutionContext) {
  const url = new URL(request.url);
  if (!eligible(request, url)) return fetch(new Request(new URL(url.pathname + url.search, env.ORIGIN || ORIGIN), request));
  const cache = globalThis.caches?.default;
  const expectedBuild = env.EXPECTED_BUILD || EXPECTED_BUILD;
  const key = keyFor(request, url, expectedBuild);
  const hit = cache ? await boundedMatch(cache, key) : undefined;
  const hitExpiry = Number(hit?.headers.get("X-VII-Cache-Until"));
  if (hit && Number.isFinite(hitExpiry) && hitExpiry > Date.now()) { const remaining = Math.floor((hitExpiry - Date.now()) / 1000); const headers = new Headers(hit.headers); headers.set("Cache-Control", `public, max-age=${Math.min(60, remaining)}`); headers.set("X-VII-Edge-Delivery", "HIT"); headers.set("X-VII-Edge-Cache-Backend", "available"); return new Response(hit.body, { status: hit.status, headers }); }
  const origin = new URL(url.pathname + url.search, env.ORIGIN || ORIGIN);
  const response = await fetch(new Request(origin, request));
  const contentType = response.headers.get("Content-Type") || "";
  const expectedType = url.pathname.endsWith(".rsc") ? "text/x-component" : "text/html";
  const control = (response.headers.get("Cache-Control") || "").toLowerCase();
  const vary = (response.headers.get("Vary") || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const allowedVary = new Set(["accept", "rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url", "x-vinext-interception-context", "x-vinext-mounted-slots", "x-vinext-rsc-render-mode", "accept-encoding"]);
  const until = Number(response.headers.get("X-VII-Cache-Until"));
  const remaining = until - Date.now();
  const declaredSize = Number(response.headers.get("Content-Length"));
  const hasUnknownSetCookie = response.headers.has("Set-Cookie") && !infrastructureSetCookieOnly(response.headers.get("Set-Cookie"));
  const reason = response.status !== 200 ? "status" : !contentType.includes(expectedType) ? "content_type" : response.headers.get("X-VII-Cache-Build") !== expectedBuild ? "build_mismatch" : hasUnknownSetCookie ? "set_cookie" : /(?:^|,)\s*(?:private|no-store|no-cache)(?:\s*(?:,|=|$))/i.test(control) ? "private_or_no_store" : vary.some((name) => !allowedVary.has(name)) ? "vary" : (Number.isFinite(declaredSize) && declaredSize > maxBytes) ? "oversize" : !Number.isFinite(until) || remaining <= 0 ? "missing_expiry" : null;
  if (reason) { const headers = new Headers(response.headers); headers.set("X-VII-Edge-Cache-Skip", reason); return new Response(response.body, { status: response.status, headers }); }
  const headers = new Headers(response.headers); headers.delete("Set-Cookie"); headers.set("Cache-Control", `public, max-age=${Math.min(60, Math.floor(remaining / 1000))}`); headers.set("X-VII-Edge-Delivery", "MISS"); headers.set("X-VII-Edge-Cache-Backend", cache ? "available" : "unavailable");
  const stored = new Response(response.body, { status: response.status, headers });
  if (cache) ctx.waitUntil(boundedBody(stored.clone().body).then((body) => body ? cache.put(key, new Response(body, { status: stored.status, headers })) : undefined).catch(() => undefined));
  const clientHeaders = new Headers(response.headers); clientHeaders.set("X-VII-Edge-Delivery", "MISS");
  return new Response(stored.body, { status: stored.status, headers: clientHeaders });
} };
