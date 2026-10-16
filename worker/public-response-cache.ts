// Only anonymous discovery responses enter this cache. Transactional reads,
// sessions, actions and unknown cookies always take the authoritative path.
export type PublicCachePolicy = {
  key: string;
  edgeUrl: string;
  kind: "document" | "data" | "navigation";
  ttlSeconds: number;
  home: boolean;
  build: string;
};

type StoredResponse = { body: ArrayBuffer; headers: [string, string][]; expiresAt: number };
type CacheEnvironment = { UPLOADS?: {
  get(key: string): Promise<{ body: ReadableStream; customMetadata?: Record<string, string> } | null>;
  put(key: string, body: ArrayBuffer, options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> }): Promise<unknown>;
} };
type Context = { waitUntil(promise: Promise<unknown>): void };
type EdgeCache = { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> };

const publicCacheVersion = "v4";
const maxResponseBytes = 2 * 1024 * 1024;
const maxMemoryBytes = 8 * 1024 * 1024;
const maxMemoryEntries = 32;
const memory = new Map<string, StoredResponse>();
let memoryBytes = 0;
const refreshing = new Set<string>();

// Optional cache storage must never hold an origin render hostage. Late
// failures are consumed, and a timeout is a miss, not a cache error page.
async function cacheLookup<T>(operation: Promise<T> | undefined, budgetMs: number): Promise<T | undefined> {
  if (!operation) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation.catch(() => undefined), new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), budgetMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export function refreshPublicCacheAhead(response: Response, policy: PublicCachePolicy, ctx: Context,
  render: () => Promise<Response>): "fresh" | "queued" | "running" | "busy" | "expired" {
  const remaining = Number(response.headers.get("X-VII-Cache-Until")) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return "expired";
  // Refresh after the first third of the existing lifetime. Never serve past
  // its original hard expiry, even if refresh fails or storage is unavailable.
  if (remaining > policy.ttlSeconds * 1000 * 2 / 3) return "fresh";
  if (refreshing.has(policy.key)) return "running";
  if (refreshing.size >= 2) return "busy";
  refreshing.add(policy.key);
  ctx.waitUntil(Promise.resolve().then(render).then(async (refreshed) => {
    // Drain the server stream so response-cache writes finish even though
    // there is no browser waiting for this background render.
    await refreshed.arrayBuffer();
  }).catch(() => console.warn("VII public cache refresh failed", policy.kind))
    .finally(() => refreshing.delete(policy.key)));
  return "queued";
}

// These cookies are evaluated by Cloudflare before our Worker and do not
// personalize VII content. Everything else is deliberately fail-closed.
const infrastructureCookies = new Set(["__cf_bm", "cf_clearance", "__cflb", "_cfuvid"]);
const routingHeaders = ["RSC", "Accept", "Next-Router-State-Tree", "Next-Router-Prefetch",
  "Next-Router-Segment-Prefetch", "Next-Url", "X-Vinext-Interception-Context",
  "X-Vinext-Mounted-Slots", "X-Vinext-Rsc-Render-Mode"];
const allowedVaryHeaders = new Set([...routingHeaders.map((header) => header.toLowerCase()), "accept-encoding"]);
const publicDocumentQueryKeys = new Set([
  "accessible", "area", "features", "flex", "from", "guests", "id", "location", "maxPrice", "minPrice",
  "months", "period", "pool", "release", "sort", "source", "spa", "till", "to", "type", "types", "whole",
]);

function hasPrivateCookies(request: Request) {
  const cookie = request.headers.get("Cookie");
  if (!cookie?.trim()) return false;
  return cookie.split(";").some((part) => {
    const separator = part.indexOf("=");
    return separator < 1 || !infrastructureCookies.has(part.slice(0, separator).trim());
  });
}

function normalizedPublicQuery(url: URL, allowed: ReadonlySet<string>) {
  const entries: [string, string][] = [];
  const seen = new Set<string>();
  for (const [key, value] of url.searchParams) {
    if (/^utm_(?:source|medium|campaign|term|content)$/.test(key)) continue;
    if (!allowed.has(key) || seen.has(key)) return null;
    seen.add(key);
    entries.push([key, value]);
  }
  entries.sort(([first], [second]) => first.localeCompare(second));
  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

function publicDocumentTtl(pathname: string) {
  const path = pathname.replace(/^\/(?:en|ru|fr)(?=\/|$)/, "") || "/";
  if (path === "/") return 300;
  if (/^\/(?:admin|account|favorites|booking|handoff|join)(?:\/|$)/.test(path)) return null;
  if (/^\/(?:business|search|holidays|hourly|events|spas|providers|attractions|activities|trails|destinations|guides|questions|corporate|gift-card|contact|accessibility)(?:\/|$)/.test(path)) return 180;
  if (/^\/(?:vacations|villas|luxury-suites|suite-complexes|vacation-apartments|discover\/place)(?:\/|$)/.test(path)) return 180;
  if (/^\/legal(?:\/|$)/.test(path)) return 900;
  return null;
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function publicCachePolicy(request: Request, url: URL, build: string): Promise<PublicCachePolicy | null> {
  if (request.method !== "GET" || request.headers.has("Authorization") || hasPrivateCookies(request)) return null;
  if (request.headers.has("Next-Action") || request.headers.has("X-Server-Action")) return null;
  // Explicit refresh must always revalidate. Normal navigation has an empty
  // or 'navigation' mode and keeps its full framework variant identity.
  const mode = request.headers.get("X-Vinext-Rsc-Render-Mode");
  if (mode && mode !== "navigation") return null;
  let kind: PublicCachePolicy["kind"];
  let query: string | null;
  let ttlSeconds: number;
  let home = false;
  if (url.pathname === "/api/catalog") {
    query = normalizedPublicQuery(url, new Set(["id", "view", "world"]));
    if (!url.searchParams.get("world")) return null;
    kind = "data";
    ttlSeconds = 300;
  } else {
    const navigation = url.pathname.endsWith(".rsc");
    const path = navigation ? url.pathname.slice(0, -4) || "/" : url.pathname;
    const ttl = publicDocumentTtl(path);
    if (!ttl) return null;
    ttlSeconds = ttl;
    if (navigation) {
      if (!(request.headers.get("Accept") || "").includes("text/x-component")) return null;
      kind = "navigation";
      query = normalizedPublicQuery(url, new Set([...publicDocumentQueryKeys, "_rsc"]));
    } else {
      if (request.headers.get("RSC") || request.headers.get("Next-Router-State-Tree")) return null;
      if (!(request.headers.get("Accept") || "").includes("text/html")) return null;
      kind = "document";
      query = normalizedPublicQuery(url, publicDocumentQueryKeys);
    }
    home = path === "/" || /^\/(?:en|ru|fr)\/?$/.test(path);
  }
  if (query === null || query.length > 600) return null;
  const variants = routingHeaders.map((name) => [name, request.headers.get(name)]);
  if (JSON.stringify(variants).length > 8192) return null;
  const identity = await digest(JSON.stringify([url.origin, url.pathname, query, variants]));
  const key = `runtime-cache/public/${publicCacheVersion}/${build}/${url.hostname}/${kind}/${identity}`;
  return { key, edgeUrl: `${url.origin}/__vii-cache/${publicCacheVersion}/${build}/${kind}/${identity}`, kind, ttlSeconds, home, build };
}

function edgeCache(): EdgeCache | undefined {
  return (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default;
}

function remember(key: string, entry: StoredResponse) {
  const old = memory.get(key);
  if (old) memoryBytes -= old.body.byteLength;
  memory.delete(key);
  memory.set(key, entry);
  memoryBytes += entry.body.byteLength;
  while (memoryBytes > maxMemoryBytes || memory.size > maxMemoryEntries) {
    const first = memory.keys().next().value!;
    memoryBytes -= memory.get(first)!.body.byteLength;
    memory.delete(first);
  }
}

function cacheHeaders(response: Response, policy: PublicCachePolicy, state: "HIT" | "MISS", layer: string, expiresAt: number) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  // Never restart the freshness window when promoting a lower-tier hit.
  headers.set("Cache-Control", `public, max-age=${Math.min(60, remaining)}, s-maxage=${remaining}`);
  headers.set(policy.kind === "document" ? "X-VII-Page-Cache" : policy.kind === "navigation" ? "X-VII-Navigation-Cache" : "X-VII-Data-Cache", state);
  headers.set("X-VII-Cache-Layer", layer);
  headers.set("X-VII-Cache-Build", policy.build);
  headers.set("X-VII-Cache-Until", String(expiresAt));
  if (policy.home) {
    headers.set("X-VII-Home-Cache", state);
    headers.set("X-VII-Home-Cache-Until", String(expiresAt));
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function readPublicCache(policy: PublicCachePolicy, env: CacheEnvironment | undefined, ctx?: Context) {
  const local = memory.get(policy.key);
  if (local) {
    if (local.expiresAt > Date.now()) {
      remember(policy.key, local);
      return cacheHeaders(new Response(local.body.slice(0), { headers: local.headers }), policy, "HIT", "memory", local.expiresAt);
    }
    memoryBytes -= local.body.byteLength;
    memory.delete(policy.key);
  }
  try {
    const response = await cacheLookup(edgeCache()?.match(new Request(policy.edgeUrl)), 50);
    const expiresAt = Number(response?.headers.get("X-VII-Cache-Until"));
    if (response && expiresAt > Date.now()) return cacheHeaders(response, policy, "HIT", "edge", expiresAt);
  } catch { /* The managed runtime may not support Cache API. R2 remains usable. */ }
  if (!env?.UPLOADS) return null;
  const cached = await cacheLookup(env.UPLOADS.get(policy.key), 150);
  if (!cached) return null;
  const expiresAt = Number(cached.customMetadata?.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  try {
    const headers = JSON.parse(cached.customMetadata?.headers || "null") as [string, string][] | null;
    if (!headers) return null;
    // Preserve framework params, mounted slots, Vary, canonical metadata and
    // noindex across tiers; an RSC body alone is not a valid navigation.
    const response = cacheHeaders(new Response(cached.body, { headers }), policy, "HIT", "r2", expiresAt);
    ctx?.waitUntil(response.clone().arrayBuffer().then(async (body) => {
      if (body.byteLength > maxResponseBytes) return;
      const storedHeaders = [...response.headers.entries()];
      remember(policy.key, { body, headers: storedHeaders, expiresAt });
      await edgeCache()?.put(new Request(policy.edgeUrl), new Response(body.slice(0), { headers: storedHeaders }));
    }).catch(() => undefined));
    return response;
  } catch { return null; }
}

export function storePublicCache(response: Response, policy: PublicCachePolicy | null, env: CacheEnvironment | undefined, ctx: Context) {
  if (!policy || response.status !== 200 || response.headers.has("Set-Cookie")) return response;
  const contentType = response.headers.get("Content-Type") || "";
  const expected = policy.kind === "document" ? "text/html" : policy.kind === "navigation" ? "text/x-component" : "application/json";
  if (!contentType.includes(expected)) return response;
  if ((response.headers.get("Vary") || "").split(",").some((name) => name.trim() && !allowedVaryHeaders.has(name.trim().toLowerCase()))) return response;
  const declaredSize = Number(response.headers.get("Content-Length"));
  if (declaredSize > maxResponseBytes) return response;
  const expiresAt = Date.now() + policy.ttlSeconds * 1000;
  const cacheable = cacheHeaders(response, policy, "MISS", "origin", expiresAt);
  const storedHeaders = [...cacheable.headers.entries()];
  ctx.waitUntil(cacheable.clone().arrayBuffer().then(async (body) => {
    if (body.byteLength > maxResponseBytes) return;
    remember(policy.key, { body, headers: storedHeaders, expiresAt });
    await Promise.allSettled([
      edgeCache()?.put(new Request(policy.edgeUrl), new Response(body.slice(0), { headers: storedHeaders })),
      env?.UPLOADS?.put(policy.key, body, {
        httpMetadata: { contentType },
        customMetadata: { expiresAt: String(expiresAt), headers: JSON.stringify(storedHeaders) },
      }),
    ]);
  }).catch((error) => console.error("VII public cache write failed", policy.kind, error)));
  return cacheable;
}
