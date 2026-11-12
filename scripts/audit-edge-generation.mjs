#!/usr/bin/env node

const baseUrl = String(process.env.VII_PUBLIC_BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const expectedBuild = String(process.env.VII_EXPECTED_BUILD || process.argv[2] || "").trim();
const routes = (process.env.VII_EDGE_AUDIT_ROUTES || "/,/search,/events,/spas,/hourly,/holidays,/providers,/trails,/attractions,/vacations/north,/business?id=vacation-104,/business?id=vacation-1296,/events/place/event-2259,/discover/place/spa-6")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const warmHeaderBudgetMs = Number(process.env.VII_EDGE_WARM_HEADER_BUDGET_MS || 1500);

if (!expectedBuild) {
  console.error("VII_EXPECTED_BUILD or the first CLI argument is required.");
  process.exit(2);
}

const read = async (route) => {
  const started = performance.now();
  const response = await fetch(new URL(route, `${baseUrl}/`), {
    // Warm the same Hebrew browser variant that production users request.
    // Without Accept-Language the release gate can pass while the first real
    // mobile visit still pays the full cold-origin cost under a different key.
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "he-IL,he;q=0.9,en;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  const headerMs = Math.round(performance.now() - started);
  await response.arrayBuffer();
  return {
    route,
    status: response.status,
    delivery: response.headers.get("x-vii-edge-delivery") || "",
    skip: response.headers.get("x-vii-edge-cache-skip") || "",
    appBuild: response.headers.get("x-vii-app-build") || "",
    cacheBuild: response.headers.get("x-vii-cache-build") || "",
    headerMs,
    totalMs: Math.round(performance.now() - started),
  };
};

const failures = [];
const results = [];
for (const route of routes) {
  const first = await read(route);
  const second = await read(route);
  results.push({ route, first, second });
  if (first.status !== 200 || second.status !== 200) failures.push(`${route}: HTTP ${first.status}/${second.status}`);
  if (first.skip === "build_mismatch" || second.skip === "build_mismatch") failures.push(`${route}: build_mismatch`);
  if (second.delivery !== "HIT") failures.push(`${route}: second request was ${second.delivery || "unclassified"}, expected HIT`);
  if (!Number.isFinite(warmHeaderBudgetMs) || warmHeaderBudgetMs <= 0) failures.push(`invalid warm header budget: ${warmHeaderBudgetMs}`);
  else if (second.headerMs > warmHeaderBudgetMs) failures.push(`${route}: warm headers ${second.headerMs}ms exceeded ${warmHeaderBudgetMs}ms`);
  for (const sample of [first, second]) {
    if (sample.appBuild && sample.appBuild !== expectedBuild) failures.push(`${route}: app build ${sample.appBuild} != ${expectedBuild}`);
    if (sample.cacheBuild && sample.cacheBuild !== expectedBuild) failures.push(`${route}: cache build ${sample.cacheBuild} != ${expectedBuild}`);
  }
}

console.log(JSON.stringify({ ok: failures.length === 0, baseUrl, expectedBuild, results, failures }, null, 2));
if (failures.length) process.exit(1);
