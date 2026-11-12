#!/usr/bin/env node

const baseUrl = String(process.env.VII_PUBLIC_BASE_URL || "https://vii.spaplus.co").replace(/\/$/, "");
const expectedBuild = String(process.env.VII_EXPECTED_BUILD || process.argv[2] || "").trim();
const routes = (process.env.VII_EDGE_AUDIT_ROUTES || "/,/events,/spas,/hourly,/vacations/north,/business?id=vacation-1296")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!expectedBuild) {
  console.error("VII_EXPECTED_BUILD or the first CLI argument is required.");
  process.exit(2);
}

const read = async (route) => {
  const response = await fetch(new URL(route, `${baseUrl}/`), {
    headers: { accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  await response.arrayBuffer();
  return {
    route,
    status: response.status,
    delivery: response.headers.get("x-vii-edge-delivery") || "",
    skip: response.headers.get("x-vii-edge-cache-skip") || "",
    appBuild: response.headers.get("x-vii-app-build") || "",
    cacheBuild: response.headers.get("x-vii-cache-build") || "",
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
  for (const sample of [first, second]) {
    if (sample.appBuild && sample.appBuild !== expectedBuild) failures.push(`${route}: app build ${sample.appBuild} != ${expectedBuild}`);
    if (sample.cacheBuild && sample.cacheBuild !== expectedBuild) failures.push(`${route}: cache build ${sample.cacheBuild} != ${expectedBuild}`);
  }
}

console.log(JSON.stringify({ ok: failures.length === 0, baseUrl, expectedBuild, results, failures }, null, 2));
if (failures.length) process.exit(1);
