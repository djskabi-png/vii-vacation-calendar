import assert from "node:assert/strict";
import test from "node:test";
import { publicCachePolicy, readPublicCache, refreshPublicCacheAhead, storePublicCache } from "../worker/public-response-cache.ts";

const origin = "https://vii.spaplus.co";
let sequence = 0;
async function policy(path = "/spas", headers = {}, build = `test-${++sequence}`) {
  const request = new Request(origin + path, { headers: { Accept: "text/html", ...headers } });
  return publicCachePolicy(request, new URL(request.url), build);
}
function context() {
  const promises = [];
  return { waitUntil(promise) { promises.push(promise); }, async settle() { await Promise.all(promises); } };
}
function r2() {
  const objects = new Map(); let reads = 0;
  return { objects, get reads() { return reads; },
    async get(key) { reads++; const entry = objects.get(key); return entry ? { body: new Response(entry.body).body, customMetadata: entry.customMetadata } : null; },
    async put(key, body, options) { objects.set(key, { body: body.slice(0), ...options }); },
  };
}

test("browser edge cookies retain public caching, sessions and unknown cookies bypass", async () => {
  const bare = await policy("/spas", {}, "same");
  for (const Cookie of ["__cf_bm=one", "__cf_bm=two; cf_clearance=passed", "_cfuvid=x; __cflb=y"]) {
    assert.equal((await policy("/spas", { Cookie }, "same"))?.key, bare.key);
  }
  for (const Cookie of ["vii_session=valid", "__cf_bm=x; vii_session=valid", "vii_oauth_nonce=x", "unknown=value", "malformed"]) {
    assert.equal(await policy("/spas", { Cookie }), null);
  }
  assert.equal(await policy("/spas", { Authorization: "Bearer x" }), null);
});

test("private, transaction, actions and refresh paths bypass every tier", async () => {
  for (const path of ["/admin", "/en/admin", "/admin.rsc?_rsc", "/account", "/fr/booking.rsc", "/favorites", "/handoff", "/join", "/api/vii/stay-quote", "/api/spa/availability", "/api/auth/session"]) {
    assert.equal(await policy(path, { Accept: "text/html, text/x-component" }), null, path);
  }
  for (const headers of [{ "Next-Action": "id" }, { "X-Server-Action": "id" }, { "X-Vinext-Rsc-Render-Mode": "refresh-preserve-ui" }]) {
    assert.equal(await policy("/spas.rsc?_rsc", { Accept: "text/x-component", ...headers }), null);
  }
  const write = new Request(origin + "/spas", { method: "POST", headers: { Accept: "text/html" } });
  assert.equal(await publicCachePolicy(write, new URL(write.url), "write"), null);
});

test("identity isolates builds, hosts, locales, filters and every Flight routing variant", async () => {
  const base = await policy("/spas", {}, "same");
  assert.notEqual((await policy("/spas", {}, "new-release")).key, base.key);
  for (const path of ["/en/spas", "/ru/spas", "/fr/spas", "/spas?location=center", "/spas?release=433"]) {
    assert.notEqual((await policy(path, {}, "same")).key, base.key);
  }
  const primary = new Request("https://www.vii.co.il/spas", { headers: { Accept: "text/html" } });
  assert.notEqual((await publicCachePolicy(primary, new URL(primary.url), "same")).key, base.key);
  const navHeaders = { Accept: "text/x-component", RSC: "1" };
  const nav = await policy("/spas.rsc?_rsc", navHeaders, "same");
  assert.equal(nav.kind, "navigation"); assert.notEqual(nav.key, base.key);
  for (const name of ["Next-Router-State-Tree", "Next-Router-Prefetch", "Next-Router-Segment-Prefetch", "Next-Url", "X-Vinext-Interception-Context", "X-Vinext-Mounted-Slots"]) {
    assert.notEqual((await policy("/spas.rsc?_rsc", { ...navHeaders, [name]: "variant" }, "same")).key, nav.key, name);
  }
  assert.equal(await policy("/spas", navHeaders), null);
  assert.equal(await policy("/spas.rsc?_rsc"), null);
  assert.equal(await policy("/spas?unknown=x"), null);
  assert.equal(await policy("/spas?guests=2&guests=6"), null);
});

test("memory serves warm responses without remote reads and retains SEO and framework metadata", async () => {
  const p = await policy(); const uploads = r2(); const ctx = context();
  const result = storePublicCache(new Response("identical content", { headers: {
    "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex", "Vary": "RSC, Accept, Next-Url", "Link": '</fonts/heebo.woff2>; rel=preload',
  } }), p, { UPLOADS: uploads }, ctx);
  assert.equal(result.headers.get("X-VII-Page-Cache"), "MISS"); await ctx.settle();
  for (let i = 0; i < 5; i++) {
    const hit = await readPublicCache(p, { UPLOADS: uploads });
    assert.equal(await hit.text(), "identical content");
    assert.equal(hit.headers.get("X-VII-Cache-Layer"), "memory");
    assert.equal(hit.headers.get("X-Robots-Tag"), "noindex");
    assert.equal(hit.headers.get("Vary"), "RSC, Accept, Next-Url");
    assert.equal(hit.headers.get("Link"), '</fonts/heebo.woff2>; rel=preload');
  }
  assert.equal(uploads.reads, 0);
});

test("R2 navigation retains params and slots, promotes to memory and keeps original expiry", async () => {
  const p = await policy("/spas.rsc?_rsc", { Accept: "text/x-component", RSC: "1" });
  const uploads = r2(); const ctx = context(); const expiresAt = Date.now() + 15000;
  uploads.objects.set(p.key, { body: new TextEncoder().encode("flight payload").buffer, customMetadata: {
    expiresAt: String(expiresAt), headers: JSON.stringify([["Content-Type", "text/x-component"], ["X-Vinext-Params", "encoded-params"], ["X-Vinext-Mounted-Slots", "root"], ["Vary", "RSC, Accept"]]),
  } });
  const hit = await readPublicCache(p, { UPLOADS: uploads }, ctx);
  assert.equal(hit.headers.get("X-VII-Navigation-Cache"), "HIT");
  assert.equal(hit.headers.get("X-Vinext-Params"), "encoded-params");
  assert.equal(hit.headers.get("X-Vinext-Mounted-Slots"), "root");
  assert.equal(hit.headers.get("X-VII-Cache-Until"), String(expiresAt));
  assert.match(hit.headers.get("Cache-Control"), /s-maxage=1[0-5]$/);
  await ctx.settle();
  assert.equal((await readPublicCache(p, { UPLOADS: uploads })).headers.get("X-VII-Cache-Layer"), "memory");
  assert.equal(uploads.reads, 1);
});

test("expired objects, errors, private responses, unsupported Vary and wrong MIME are not cached", async () => {
  const uploads = r2(); const ctx = context(); const expired = await policy();
  uploads.objects.set(expired.key, { body: new ArrayBuffer(0), customMetadata: { expiresAt: String(Date.now() - 1), headers: '[]' } });
  assert.equal(await readPublicCache(expired, { UPLOADS: uploads }), null);
  for (const response of [
    new Response("error", { status: 503, headers: { "Content-Type": "text/html" } }),
    new Response("private", { headers: { "Content-Type": "text/html", "Set-Cookie": "vii_session=private" } }),
    new Response("variant", { headers: { "Content-Type": "text/html", Vary: "Cookie" } }),
    new Response("flight", { headers: { "Content-Type": "text/x-component" } }),
  ]) {
    const p = await policy(); storePublicCache(response, p, { UPLOADS: uploads }, ctx); await ctx.settle();
    assert.equal(await readPublicCache(p, { UPLOADS: uploads }), null);
  }
});

test("the cache is optional when edge and R2 are unavailable", async () => {
  assert.equal(await readPublicCache(await policy(), undefined), null);
});

test("refresh-ahead is nonblocking, deduplicated, capped and retains hard expiry", async () => {
  const p = await policy(); const ctx = context(); let renders = 0; let complete;
  const expiresAt = Date.now() + 60_000;
  const cached = new Response("still valid", { headers: { "X-VII-Cache-Until": String(expiresAt) } });
  const render = () => { renders++; return new Promise((resolve) => { complete = resolve; }); };
  assert.equal(refreshPublicCacheAhead(cached, p, ctx, render), "queued");
  assert.equal(refreshPublicCacheAhead(cached, p, ctx, render), "running");
  assert.equal(await cached.text(), "still valid"); // no wait for render
  assert.equal(renders, 1);
  assert.equal(cached.headers.get("X-VII-Cache-Until"), String(expiresAt));
  const other = await policy(); let releaseOther;
  assert.equal(refreshPublicCacheAhead(new Response(null, { headers: { "X-VII-Cache-Until": String(expiresAt) } }), other, ctx,
    () => new Promise((resolve) => { releaseOther = resolve; })), "queued");
  assert.equal(refreshPublicCacheAhead(new Response(null, { headers: { "X-VII-Cache-Until": String(expiresAt) } }), await policy(), ctx, render), "busy");
  assert.equal(refreshPublicCacheAhead(new Response(null, { headers: { "X-VII-Cache-Until": String(Date.now() - 1) } }), p, ctx, render), "expired");
  assert.equal(refreshPublicCacheAhead(new Response(null, { headers: { "X-VII-Cache-Until": String(Date.now() + 175_000) } }), p, ctx, render), "fresh");
  complete(new Response("new")); releaseOther(new Response("other")); await ctx.settle();
  const failure = context();
  assert.equal(refreshPublicCacheAhead(new Response(null, { headers: { "X-VII-Cache-Until": String(expiresAt) } }), p, failure,
    async () => { throw new Error("origin unavailable"); }), "queued");
  await failure.settle();
  const retry = context();
  assert.equal(refreshPublicCacheAhead(new Response(null, { headers: { "X-VII-Cache-Until": String(expiresAt) } }), p, retry,
    async () => new Response("recovered")), "queued");
  await retry.settle();
});

test("hung optional R2 read has a bounded miss and late errors are consumed", async () => {
  const p = await policy(); const started = performance.now(); let rejectLate;
  const result = await readPublicCache(p, { UPLOADS: { get: () => new Promise((_, reject) => { rejectLate = reject; }) } });
  assert.equal(result, null);
  assert.ok(performance.now() - started < 1600, "optional storage blocked rendering");
  rejectLate(new Error("late storage error"));
});

test("cross-region R2 hits slower than150ms remain usable instead of forcing full renders", async()=>{
  const p=await policy();const expiresAt=Date.now()+60_000;
  const response=await readPublicCache(p,{UPLOADS:{get:()=>new Promise(resolve=>setTimeout(()=>resolve({
    body:new Response('valid regional hit').body,customMetadata:{expiresAt:String(expiresAt),headers:'[["Content-Type","text/html"]]'}
  }),200))}});
  assert.equal(response.headers.get('X-VII-Cache-Layer'),'r2');assert.equal(await response.text(),'valid regional hit');
});
