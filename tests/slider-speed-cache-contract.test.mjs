import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../services/vii-edge-delivery/src/index.ts";
import { dealClockKey } from "../app/lib/deal-clock.ts";
import { publicDiscoveryCachePolicy } from "../shared/public-discovery-cache.ts";
import { verifiedPublicDiscoveryHeaders } from "../app/lib/public-discovery-response.ts";

const root = new URL("../", import.meta.url);

test("verified slider discovery receives only a bounded anonymous cache lease", () => {
  const now = new Date("2026-11-11T10:00:00.000Z");
  const clock = dealClockKey(now);
  const request = new Request(`https://vii.spaplus.co/api/spa/deals?clock=${encodeURIComponent(clock)}&rotation=123456`);
  const policy = publicDiscoveryCachePolicy(request, now);
  const build = "12345678-1234-1234-1234-123456789abc";
  const headers = verifiedPublicDiscoveryHeaders(request, now, build);
  assert.ok(policy);
  assert.ok(policy.ttlSeconds > 0 && policy.ttlSeconds <= 120);
  assert.equal(headers["X-VII-Cache-Build"], build);
  assert.equal(headers["X-VII-Discovery-Verified"], "1");
  assert.equal(Number(headers["X-VII-Cache-Until"]), policy.expiresAt);
  assert.match(headers["Cache-Control"], /^public, max-age=0, s-maxage=\d+$/);

  const unsafe = verifiedPublicDiscoveryHeaders(new Request(`https://vii.spaplus.co/api/spa/deals?clock=${encodeURIComponent(clock)}&rotation=bad%20value`), now, build);
  assert.equal(unsafe["Cache-Control"], "no-store");
});

test("the edge serves a second verified slider request without another origin call", async () => {
  const now = new Date();
  const clock = dealClockKey(now);
  const url = `https://vii.spaplus.co/api/vii/home-deals?period=tomorrow&locale=he&proof=verified-offers-v1&clock=${encodeURIComponent(clock)}`;
  const policy = publicDiscoveryCachePolicy(new Request(url), now);
  assert.ok(policy);
  const entries = new Map();
  let originCalls = 0;
  const oldFetch = globalThis.fetch;
  const oldCaches = globalThis.caches;
  globalThis.caches = { default: {
    async match(key) { return entries.get(key.url)?.clone(); },
    async put(key, response) { entries.set(key.url, response.clone()); },
  } };
  globalThis.fetch = async () => {
    originCalls += 1;
    return Response.json({ availabilityStatus: "verified", deals: [] }, { headers: {
      "Cache-Control": `public, max-age=0, s-maxage=${policy.ttlSeconds}`,
      "X-VII-Cache-Build": "slider-build",
      "X-VII-Cache-Until": String(policy.expiresAt),
      "X-VII-Discovery-Verified": "1",
    } });
  };
  try {
    const env = { ORIGIN: "https://vii-vacation-calendar.adir-naor-7510.chatgpt.site", EXPECTED_BUILD: "slider-build" };
    const ctx = { waitUntil(promise) { return promise; } };
    const first = await worker.fetch(new Request(url), env, ctx);
    assert.equal(first.headers.get("X-VII-Edge-Delivery"), "MISS");
    await new Promise(resolve => setTimeout(resolve, 0));
    const second = await worker.fetch(new Request(url), env, ctx);
    assert.equal(second.headers.get("X-VII-Edge-Delivery"), "HIT");
    assert.equal(originCalls, 1);
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.caches = oldCaches;
  }
});

test("visible slider images are high priority while deferred rails preserve geometry", async () => {
  const [home, spa, events, pacing, activation] = await Promise.all([
    readFile(new URL("app/components/home-live-deals.tsx", root), "utf8"),
    readFile(new URL("app/components/spa-package-deals.tsx", root), "utf8"),
    readFile(new URL("app/components/event-last-minute.tsx", root), "utf8"),
    readFile(new URL("app/components/use-paced-rail-render.ts", root), "utf8"),
    readFile(new URL("app/components/use-section-activation.ts", root), "utf8"),
  ]);
  assert.match(home, /priority=\{active && index < 2\}/);
  assert.match(spa, /priority=\{active && index<2\}/);
  assert.match(events, /priority=\{active && index < 2\}/);
  assert.match(home, /Reserve every snap area at once/);
  assert.match(pacing, /schedulePacedRailRender/);
  assert.match(activation, /observeSectionActivation\(element, \(\) => setActive\(true\), undefined, rootMargin\)/);
  for (const source of [home, spa, events]) assert.match(source, /useSectionActivation\([^\n]+"900px 0px"\)/);
});

test("holiday tabs retain verified cards while bounded browser priming shares in-flight work", async () => {
  const home = await readFile(new URL("app/components/home-live-deals.tsx", root), "utf8");
  assert.match(home, /const backgroundPrimeLimit = 5/);
  assert.match(home, /const existing = holidayPrimeRequests\.get\(key\);\s*if \(existing\) return boundedPrimeWait\(existing\.promise, waitBudgetMs\)/);
  assert.doesNotMatch(home, /cancelPendingHomeHolidayPrime/);
  assert.match(home, /const retainedData = data \?\? \(state === "loading"/);
  assert.match(home, /displayState === "loading" && retainedData !== null/);
  assert.match(home, /recoveryDeadlineTimer = setTimeout/);
});

test("scheduled vacation sync warms ordinary and holiday slider snapshots", async () => {
  const route = await readFile(new URL("app/mcp/route.ts", root), "utf8");
  assert.match(route, /warmVacationDiscoveryCache/);
  assert.match(route, /warmHolidayDiscoveryCache/);
  assert.match(route, /Promise\.all\(\[[\s\S]*warmVacationDiscoveryCache\(db\)[\s\S]*warmHolidayDiscoveryCache\(db\)/);
});

test("scheduled discovery also warms spa and injects gallery storage into catalog sync", async () => {
  const worker = await readFile(new URL("worker/index.ts", root), "utf8");
  assert.match(worker, /warmSpaDiscoveryCache\(database, scheduledAt, env\.BIZONLINE_SPA_AVAILABILITY_TOKEN\)/);
  assert.match(worker, /runSupplierCatalogScheduleTick\(database, \{ now: new Date\(controller\.scheduledTime\), mediaArchive: \{ bucket: env\.UPLOADS \} \}\)/);
  const client = await readFile(new URL("app/components/spa-package-deals.tsx", root), "utf8");
  assert.doesNotMatch(client, /rotation:String\(/, "SPA transport cache identity is canonical across presentation seeds");
  assert.match(client, /orderDiscoveryRail\)[\s\S]*seed: `\$\{documentSeed\}:spa:/, "presentation rotation remains client-side");
  assert.match(client, /persist:true, freshMs:120_000, staleMs:900_000/);
});

