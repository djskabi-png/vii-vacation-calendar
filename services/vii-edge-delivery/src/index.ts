import { warmPublicDocuments } from "./public-warm.ts";
import {publicDiscoveryCachePolicy} from '../../../shared/public-discovery-cache.ts';
import {globalPublicVariant,readGlobalPublicCache,writeGlobalPublicCache,type PublicCacheBucket} from './global-public-cache.ts';
import { qualityGateway, type QualityGatewayEnvironment } from './quality-gateway.ts';
import {readRetainedAsset,retainedAssetRequest} from './retained-assets.ts';
import { experienceGateway, type ExperienceGatewayEnvironment } from './experience-gateway.ts';
import { deliverPublicRubikFont } from './font-delivery.ts';
import { publicDocumentClock, publicDocumentExpiry } from '../../../shared/public-document-clock.ts';
type DeliveryEnv=QualityGatewayEnvironment & ExperienceGatewayEnvironment & {ORIGIN?:string;EXPECTED_BUILD?:string;PUBLIC_CACHE?:PublicCacheBucket};
type EdgeExecutionContext = { waitUntil(promise: Promise<unknown>): void };
const ORIGIN = "https://vii-vacation-calendar.adir-naor-7510.chatgpt.site";
const EXPECTED_BUILD = "00bca36c-4f1c-403d-9a13-ceea797015ae";
const EDGE_CACHE_VERSION = "v22";
const refreshAfterHeader = "X-VII-Edge-Refresh-After";
const refreshes = new Set<string>();
const refreshAttempts = new Map<string, number>();
const allowedQuery = new Set(["accessible", "area", "features", "flex", "from", "guests", "id", "location", "maxPrice", "minPrice", "months", "online", "period", "pool", "release", "sort", "source", "spa", "till", "to", "type", "types", "whole", "_rsc"]);
const allowedUtm = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);
const variantHeaders = ["Accept", "RSC", "Next-Router-State-Tree", "Next-Router-Prefetch", "Next-Router-Segment-Prefetch", "Next-Url", "X-Vinext-Interception-Context", "X-Vinext-Mounted-Slots", "X-Vinext-Rsc-Render-Mode"];
const maxBytes = 2 * 1024 * 1024;
const publicShellSessionCookies = new Set(["vii_customer_session", "vii_admin_session", "vii_session"]);
const infrastructureCookies = new Set(["__cf_bm", "cf_clearance", "__cflb", "_cfuvid"]);
// These client-only analytics identifiers never personalize the public shell.
// Keep them separate from infrastructure cookies: they must not be forwarded
// to the shared origin or make a Set-Cookie response eligible for caching.
function anonymousAnalyticsCookie(name: string) {
  return /^_ga(?:_[A-Za-z0-9]+)?$/.test(name) || name === "_gid"
    || /^_gat(?:_[A-Za-z0-9_-]+)?$/.test(name) || name === "_gcl_au";
}
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
  let timer: number | undefined;
  try { return await Promise.race([cache.match(key).catch(() => undefined), new Promise<undefined>((resolve) => { timer = setTimeout(resolve, 100); })]); }
  finally { if (timer) clearTimeout(timer); }
}

function privateRequest(request: Request) {
  if (request.method !== "GET" || request.headers.has("Authorization") || request.headers.has("Next-Action") || request.headers.has("X-Server-Action")) return true;
  const cookie = request.headers.get("Cookie");
  if (!cookie?.trim()) return false;
  return cookie.split(";").some(part => {
    if (!part.trim()) return false;
    const separator = part.indexOf("=");
    const name = part.slice(0, separator).trim();
    return separator < 1 || !infrastructureCookies.has(name) && !publicShellSessionCookies.has(name) && !anonymousAnalyticsCookie(name);
  });
}

function bypassOrigin(requestUrl: URL, configuredOrigin: string | undefined) {
  // On the attached public host, private/session/action requests must retain
  // the public origin. Rewriting them to the staging Site alias can break
  // host-bound server actions and CSRF/origin checks. The workers.dev probe
  // continues to use the configured staging origin.
  return requestUrl.hostname === "vii.spaplus.co" ? requestUrl.origin : configuredOrigin || ORIGIN;
}

// Public HTML and public RSC contain no account state. Fetch their anonymous
// projection even for signed-in visitors; account data continues through the
// original uncached API/private/action requests. Never forward viewer identity
// into a response that can be admitted to the shared cache.
function anonymousPublicRequest(origin: URL, request: Request) {
  const headers = new Headers();
  for (const name of [...variantHeaders, "Accept-Language", "User-Agent", "If-None-Match", "If-Modified-Since"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const infrastructure = (request.headers.get("Cookie") || "").split(";").filter(part => {
    const separator = part.indexOf("=");
    return separator > 0 && infrastructureCookies.has(part.slice(0, separator).trim());
  }).map(part => part.trim()).join("; ");
  if (infrastructure) headers.set("Cookie", infrastructure);
  return new Request(origin, { method: "GET", headers, redirect: "manual", signal: request.signal });
}

function eligible(request: Request, url: URL) {
  if(!privateRequest(request)&&publicDiscoveryCachePolicy(request))return true;
  if (privateRequest(request) || url.pathname.startsWith("/api/") || /^\/(?:admin|account|favorites|booking|handoff|join)(?:\/|$)/.test(url.pathname)) return false;
  const rsc = url.pathname.endsWith(".rsc");
  const path = (rsc ? url.pathname.slice(0, -4) || "/" : url.pathname).replace(/^\/(?:en|ru|fr)(?=\/|$)/, "") || "/";
  if (!/^\/(?:$|last-minute(?:\/|$)|weekend(?:\/|$)|search(?:\/|$)|events(?:\/|$)|spas(?:\/|$)|hourly(?:\/|$)|vacations(?:\/|$)|villas(?:\/|$)|zimmers(?:\/|$)|suites(?:\/|$)|luxury-suites(?:\/|$)|suite-complexes(?:\/|$)|vacation-apartments(?:\/|$)|hospitality-complexes(?:\/|$)|business(?:\/|$)|discover\/place(?:\/|$)|holidays(?:\/|$)|providers(?:\/|$)|attractions(?:\/|$)|activities(?:\/|$)|trails(?:\/|$)|destinations(?:\/|$)|corporate(?:\/|$)|guides(?:\/|$)|questions(?:\/|$)|gift-card(?:\/|$)|contact(?:\/|$)|accessibility(?:\/|$)|legal(?:\/|$))/.test(path)) return false;
  if (rsc ? !(request.headers.get("Accept") || "").includes("text/x-component") : !(request.headers.get("Accept") || "").includes("text/html")) return false;
  const seen = new Set(); for (const key of url.searchParams.keys()) { if (allowedUtm.has(key)) continue; if (!allowedQuery.has(key) || seen.has(key)) return false; seen.add(key); }
  if (request.headers.get("RSC") || request.headers.get("Next-Router-State-Tree")) return rsc;
  return !rsc;
}

function safePublicRead(request: Request, url: URL) {
  // These two extra search fields are passed through unchanged, even when
  // the main application's cache policy intentionally declines admission.
  if (["children", "rooms"].some(key => url.searchParams.getAll(key).length > 1)) return false;
  const eligibilityOnly = new URL(url);
  eligibilityOnly.searchParams.delete("children");
  eligibilityOnly.searchParams.delete("rooms");
  return eligible(request, eligibilityOnly);
}

async function fetchPublicRead(request: Request, origin: URL) {
  const anonymous = anonymousPublicRequest(origin, request);
  let failed: Response | undefined;
  try {
    const response = await fetch(anonymous);
    if (response.status < 500) return response;
    failed = response;
  } catch (error) {
    if (request.signal.aborted || error instanceof Error && error.name === "AbortError") throw error;
  }
  if (request.signal.aborted) throw request.signal.reason;
  await failed?.body?.cancel().catch(() => undefined);
  const headers = new Headers(anonymous.headers);
  headers.set("Cache-Control", "no-cache");
  headers.delete("If-None-Match");
  headers.delete("If-Modified-Since");
  // Exactly one changed, read-only retry. Private/API/action/POST traffic
  // never enters this helper, and a second failure is returned unchanged.
  return fetch(new Request(anonymous, { headers, cache: "reload", redirect: "manual" }));
}

function keyFor(request: Request, url: URL, build: string, now = new Date()) {
  const query = [...url.searchParams.entries()].filter(([key]) => !allowedUtm.has(key)).sort().map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
  const accept = request.headers.get("Accept") || "";
  const htmlTypes = new Set(["text/html", "application/xhtml+xml", "application/xml", "text/xml", "image/avif", "image/webp", "image/apng", "image/svg+xml", "application/signed-exchange", "*/*"]);
  const ordinaryHtml = !url.pathname.endsWith(".rsc") && !request.headers.has("RSC") && !request.headers.has("Next-Router-State-Tree")
    && accept.includes("text/html") && accept.split(",").every(part => htmlTypes.has(part.split(";")[0].trim().toLowerCase()));
  const clock = publicDocumentClock(url.pathname, now);
  const variants = encodeURIComponent(variantHeaders.map((name) => `${name}:${name === "Accept" && ordinaryHtml ? "text/html" : request.headers.get(name) || ""}`).join("|"));
  return new Request(`${url.origin}/__vii-edge/${EDGE_CACHE_VERSION}/${encodeURIComponent(url.pathname)}?${query}${query ? "&" : ""}__build=${encodeURIComponent(build)}&__variants=${variants}${clock ? `&__clock=${encodeURIComponent(clock)}` : ""}`);
}

function deliveryTiming(headers: Headers, lookupMs: number, originMs?: number) {
  headers.set("X-VII-Edge-Lookup-Ms", String(lookupMs));
  // Origin cache timings can be retained inside stored public HTML. These
  // distinct names always describe this delivery, never the original fill.
  headers.delete("X-VII-Edge-Origin-Ms");
  // Stored HTML may carry timing entries from the request that populated it.
  // Preserve application/server timings, but never expose stale Edge timings
  // as if they described this delivery.
  const existing = headers.get("Server-Timing");
  if (existing) {
    const entries: string[] = []; let start = 0; let quoted = false; let escaped = false;
    for (let index = 0; index < existing.length; index++) {
      const character = existing[index];
      if (escaped) { escaped = false; continue; }
      if (quoted && character === "\\") { escaped = true; continue; }
      if (character === '"') { quoted = !quoted; continue; }
      if (!quoted && character === ",") { entries.push(existing.slice(start, index).trim()); start = index + 1; }
    }
    entries.push(existing.slice(start).trim());
    const current = entries
      .filter((value) => !/^vii-edge-(?:lookup|origin)\s*(?:;|$)/i.test(value));
    if (current.length) headers.set("Server-Timing", current.join(", "));
    else headers.delete("Server-Timing");
  }
  const timings = [`vii-edge-lookup;dur=${lookupMs}`];
  if (originMs != null) {
    headers.set("X-VII-Edge-Origin-Ms", String(originMs));
    timings.push(`vii-edge-origin;dur=${originMs}`);
  }
  headers.append("Server-Timing", timings.join(", "));
}

async function serve(request: Request, env: DeliveryEnv, ctx: EdgeExecutionContext, refresh = false): Promise<Response> {
  if (env.QUALITY_CONTROL_ENABLED === "true") {
    const experience = await experienceGateway(request, env);
    if (experience) return experience;
    const quality = await qualityGateway(request, env);
    if (quality) return quality;
  }
  const url = new URL(request.url);
  const discovery=publicDiscoveryCachePolicy(request);
  if (!eligible(request, url)) {
    if (safePublicRead(request, url)) return fetchPublicRead(request, new URL(url.pathname + url.search, bypassOrigin(url, env.ORIGIN)));
    const upstream = new Request(new URL(url.pathname + url.search, bypassOrigin(url, env.ORIGIN)), request);
    const response=deliverPublicRubikFont(request, await fetch(new Request(upstream, { redirect: "manual" })));
    if((response.status===404||response.status===410)&&retainedAssetRequest(request)){
      const retained=await readRetainedAsset(request,env.PUBLIC_CACHE);
      if(retained){void response.body?.cancel().catch(()=>undefined);return retained;}
    }
    return response;
  }
  const cache = (globalThis.caches as unknown as { default?: Cache } | undefined)?.default;
  const expectedBuild = env.EXPECTED_BUILD || EXPECTED_BUILD;
  const clockNow = new Date(Date.now());
  const key = keyFor(request, url, expectedBuild, clockNow);
  const lookupStarted = performance.now();
  let hit = cache && !refresh ? await boundedMatch(cache, key) : undefined;
  if(hit&&(!Number.isFinite(Number(hit.headers.get('X-VII-Cache-Until')))||Number(hit.headers.get('X-VII-Cache-Until'))<=Date.now()))hit=undefined;
  let hitLayer='available';
  const globalVariant=globalPublicVariant(request,expectedBuild);
  if(!hit&&!refresh&&globalVariant){
    hit=await readGlobalPublicCache(env.PUBLIC_CACHE,key,expectedBuild);
    if(hit){hitLayer='global-r2';if(cache)ctx.waitUntil(cache.put(key,hit.clone()).catch(()=>undefined));}
  }
  const hitExpiry = Number(hit?.headers.get("X-VII-Cache-Until"));
  if (hit && Number.isFinite(hitExpiry) && hitExpiry > Date.now()) {
    const refreshAfter = Number(hit.headers.get(refreshAfterHeader));
    if (refreshAfter > 0 && Date.now() >= refreshAfter && (refreshAttempts.get(key.url) || 0) <= Date.now() && refreshes.size < 2 && !refreshes.has(key.url)) {
      refreshes.add(key.url);
      refreshAttempts.delete(key.url);
      refreshAttempts.set(key.url, Date.now() + 30_000);
      if (refreshAttempts.size > 128) refreshAttempts.delete(refreshAttempts.keys().next().value!);
      // This calls the SAME anonymous fetch, admission and bounded storage path
      // as a MISS. Only the local lookup is skipped; no request header can
      // activate the internal flag. The current HIT is returned immediately.
      const backgroundRequest = new Request(request, { signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]) });
      ctx.waitUntil(Promise.resolve().then(() => serve(backgroundRequest, env, ctx, true))
        .then(async response => { await boundedBody(response.body); })
        .catch(() => undefined).finally(() => refreshes.delete(key.url)));
    }
    const remaining = Math.floor((hitExpiry - Date.now()) / 1000);
    const headers = new Headers(hit.headers);
    deliveryTiming(headers, Math.round(performance.now() - lookupStarted));
    headers.delete(refreshAfterHeader);
    headers.set("Cache-Control", `public, max-age=${discovery?0:Math.min(60, remaining)}`);
    headers.set("X-VII-Edge-Delivery", "HIT"); headers.set("X-VII-Edge-Cache-Backend", hitLayer);
    return new Response(hit.body, { status: hit.status, headers });
  }
  const origin = new URL(url.pathname + url.search, bypassOrigin(url, env.ORIGIN));
  const lookupMs = Math.round(performance.now() - lookupStarted);
  const originStarted = performance.now();
  let response = await fetchPublicRead(request, origin);
  const originExpiry = Number(response.headers.get("X-VII-Cache-Until"));
  if (Number.isFinite(originExpiry) && originExpiry > 0 && publicDocumentClock(url.pathname)) {
    const capped = publicDocumentExpiry(url.pathname, originExpiry, clockNow);
    const headers = new Headers(response.headers);
    headers.set("X-VII-Cache-Until", String(capped));
    const remaining = Math.max(0, Math.floor((capped - Date.now()) / 1000));
    // Do not relax private directives while bounding a public lifetime.
    if (!/(?:private|no-store|no-cache)/i.test(headers.get("Cache-Control") || ""))
      headers.set("Cache-Control", `public, max-age=${Math.min(60, remaining)}, s-maxage=${remaining}`);
    response = new Response(response.body, {status: response.status, statusText: response.statusText, headers});
  }
  const originMs = Math.round(performance.now() - originStarted);
  const contentType = response.headers.get("Content-Type") || "";
  const expectedType = discovery?'application/json':url.pathname.endsWith(".rsc") ? "text/x-component" : "text/html";
  const control = (response.headers.get("Cache-Control") || "").toLowerCase();
  const vary = (response.headers.get("Vary") || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  const allowedVary = new Set(["accept", "rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url", "x-vinext-interception-context", "x-vinext-mounted-slots", "x-vinext-rsc-render-mode", "accept-encoding"]);
  const until = Number(response.headers.get("X-VII-Cache-Until"));
  const remaining = until - Date.now();
  const declaredSize = Number(response.headers.get("Content-Length"));
  const hasUnknownSetCookie = response.headers.has("Set-Cookie") && !infrastructureSetCookieOnly(response.headers.get("Set-Cookie"));
  const reason = response.status !== 200 ? "status" : !contentType.includes(expectedType) ? "content_type" : response.headers.get("X-VII-Cache-Build") !== expectedBuild ? "build_mismatch" : hasUnknownSetCookie ? "set_cookie" : /(?:^|,)\s*(?:private|no-store|no-cache)(?:\s*(?:,|=|$))/i.test(control) ? "private_or_no_store" : vary.some((name) => !allowedVary.has(name)) ? "vary" : (Number.isFinite(declaredSize) && declaredSize > maxBytes) ? "oversize" : !Number.isFinite(until) || remaining <= 0 ? "missing_expiry" : discovery&&(response.headers.get('X-VII-Discovery-Verified')!=='1'||until>discovery.expiresAt+1000)?'discovery_authority':null;
  if (reason) { const headers = new Headers(response.headers); deliveryTiming(headers, lookupMs, originMs); headers.set("X-VII-Edge-Cache-Skip", reason); return new Response(response.body, { status: response.status, headers }); }
  const headers = new Headers(response.headers); headers.delete("Set-Cookie"); headers.set("Cache-Control", `public, max-age=${Math.min(60, Math.floor(remaining / 1000))}`); headers.set("X-VII-Edge-Delivery", "MISS"); headers.set("X-VII-Edge-Cache-Backend", cache ? "available" : "unavailable");
  const storedHeaders = new Headers(headers);
  // The browser-facing response remains capped at 60s, while the internal
  // Cache API entry may live for the origin-approved hard expiry.
  storedHeaders.set("Cache-Control", `public, max-age=${Math.max(0, Math.floor(remaining / 1000))}`);
  storedHeaders.set(refreshAfterHeader, String(Date.now() + Math.floor(remaining / 3)));
  const stored = new Response(response.body, { status: response.status, headers: storedHeaders });
  if (cache || globalVariant&&env.PUBLIC_CACHE) ctx.waitUntil(boundedBody(stored.clone().body).then(async body=>{
    if(!body)return;
    await Promise.allSettled([
      ...(cache?[cache.put(key,new Response(body,{status:stored.status,headers:storedHeaders}))]:[]),
      ...(globalVariant?[writeGlobalPublicCache(env.PUBLIC_CACHE,key,expectedBuild,body,storedHeaders)]:[]),
    ]);
  }).catch(()=>undefined));
  const clientHeaders = new Headers(response.headers); clientHeaders.delete(refreshAfterHeader); clientHeaders.set("X-VII-Edge-Delivery", "MISS");
  deliveryTiming(clientHeaders, lookupMs, originMs);
  return new Response(stored.body, { status: stored.status, headers: clientHeaders });
}
type EdgeScheduledController = { scheduledTime: number; cron: string; noRetry?: () => void };
export default { fetch: serve, async scheduled(_controller: EdgeScheduledController, env: DeliveryEnv, ctx: EdgeExecutionContext) {
  if ((env.EXPECTED_BUILD || EXPECTED_BUILD).startsWith("pending-")) return;
  const work = warmPublicDocuments((request, ownedContext) => serve(request, env, ownedContext as EdgeExecutionContext), ctx);
  ctx.waitUntil(work);
  const report = await work;
  console.log("VII public document warming", { build: env.EXPECTED_BUILD || EXPECTED_BUILD, ...report });
  if (!report.completed) throw new Error("public_document_warming_unavailable");
} };
