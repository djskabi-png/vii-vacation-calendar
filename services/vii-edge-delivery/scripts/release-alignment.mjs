#!/usr/bin/env node

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BUILD_PATTERN = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
export const PENDING_PATTERN = /^pending-[a-z0-9][a-z0-9-]{7,80}$/;

const defaultRoutes = [
  "/", "/search", "/events", "/spas", "/hourly", "/holidays", "/providers",
  "/trails", "/attractions", "/vacations/north", "/business?id=vacation-1296",
  "/events/place/event-2259", "/discover/place/spa-25",
  "/discover/place/spa-25?date=2026-11-13&package=4193",
];

export function readSourceBuilds(sourceText, wranglerText) {
  const sourceMatches = [...sourceText.matchAll(/^const EXPECTED_BUILD = "([^"]+)";$/gm)];
  const configMatches = [...wranglerText.matchAll(/^EXPECTED_BUILD = "([^"]+)"$/gm)];
  if (sourceMatches.length !== 1 || configMatches.length !== 1) {
    throw new Error(`expected_build_definition_count:${sourceMatches.length}:${configMatches.length}`);
  }
  return { source: sourceMatches[0][1], config: configMatches[0][1] };
}

export function validateSourceAlignment(sourceText, wranglerText, { allowPending = true } = {}) {
  const builds = readSourceBuilds(sourceText, wranglerText);
  if (builds.source !== builds.config) throw new Error(`edge_source_config_mismatch:${builds.source}:${builds.config}`);
  if (!BUILD_PATTERN.test(builds.source) && !(allowPending && PENDING_PATTERN.test(builds.source))) {
    throw new Error(`edge_expected_build_invalid:${builds.source}`);
  }
  return builds.source;
}

export function bindBuildText(sourceText, wranglerText, build) {
  if (!BUILD_PATTERN.test(build) && !PENDING_PATTERN.test(build)) throw new Error(`requested_build_invalid:${build}`);
  validateSourceAlignment(sourceText, wranglerText);
  return {
    source: sourceText.replace(/^const EXPECTED_BUILD = "[^"]+";$/m, `const EXPECTED_BUILD = "${build}";`),
    config: wranglerText.replace(/^EXPECTED_BUILD = "[^"]+"$/m, `EXPECTED_BUILD = "${build}"`),
  };
}

function atomicPairWrite(sourcePath, configPath, next) {
  const sourceTemporary = `${sourcePath}.release-alignment.tmp`;
  const configTemporary = `${configPath}.release-alignment.tmp`;
  writeFileSync(sourceTemporary, next.source, "utf8");
  writeFileSync(configTemporary, next.config, "utf8");
  validateSourceAlignment(readFileSync(sourceTemporary, "utf8"), readFileSync(configTemporary, "utf8"));
  renameSync(sourceTemporary, sourcePath);
  renameSync(configTemporary, configPath);
}

const browserHeaders = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "he-IL,he;q=0.9,en;q=0.8",
};

export async function inspectPublicRoute(baseUrl, route, expectedBuild, fetcher = fetch) {
  const started = performance.now();
  const response = await fetcher(new URL(route, `${baseUrl.replace(/\/$/, "")}/`), {
    headers: browserHeaders, redirect: "follow", signal: AbortSignal.timeout(20_000),
  });
  const headerMs = Math.round(performance.now() - started);
  await response.arrayBuffer();
  const appBuild = response.headers.get("x-vii-app-build") || "";
  const cacheBuild = response.headers.get("x-vii-cache-build") || "";
  return {
    route, status: response.status,
    delivery: response.headers.get("x-vii-edge-delivery") || "",
    skip: response.headers.get("x-vii-edge-cache-skip") || "",
    backend: response.headers.get("x-vii-edge-cache-backend") || "",
    appBuild, cacheBuild, headerMs, totalMs: Math.round(performance.now() - started),
    buildMatches: [appBuild, cacheBuild].filter(Boolean).every(value => value === expectedBuild),
  };
}

export async function verifyPublicAlignment({ baseUrl = "https://vii.spaplus.co", expectedBuild,
  routes = defaultRoutes, warmHeaderBudgetMs = 1500, fetcher = fetch } = {}) {
  if (!BUILD_PATTERN.test(expectedBuild || "")) throw new Error("public_expected_build_invalid");
  const results = [], failures = [];
  for (const route of routes) {
    const first = await inspectPublicRoute(baseUrl, route, expectedBuild, fetcher);
    const second = await inspectPublicRoute(baseUrl, route, expectedBuild, fetcher);
    results.push({ route, first, second });
    if (first.status !== 200 || second.status !== 200) failures.push(`${route}:http:${first.status}/${second.status}`);
    if (!first.appBuild && !first.cacheBuild || !second.appBuild && !second.cacheBuild) failures.push(`${route}:build_header_missing`);
    if (!first.buildMatches || !second.buildMatches) failures.push(`${route}:observed_build_mismatch`);
    if (first.skip === "build_mismatch" || second.skip === "build_mismatch") failures.push(`${route}:edge_build_mismatch`);
    if (second.delivery !== "HIT") failures.push(`${route}:warm_delivery:${second.delivery || "unclassified"}`);
    if (second.headerMs > warmHeaderBudgetMs) failures.push(`${route}:warm_header_budget:${second.headerMs}`);
  }
  return { ok: failures.length === 0, baseUrl, expectedBuild, warmHeaderBudgetMs, results, failures };
}

function option(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const sourcePath = resolve(root, "src/index.ts"), configPath = resolve(root, "wrangler.toml");
  const sourceText = readFileSync(sourcePath, "utf8"), configText = readFileSync(configPath, "utf8");
  const current = validateSourceAlignment(sourceText, configText);
  const bind = option("--bind"), suspend = option("--suspend");
  if (bind && suspend || process.argv.filter(value => value === "--bind" || value === "--suspend").length > 1) {
    throw new Error("choose_exactly_one_release_transition");
  }
  if (bind || suspend) {
    const requested = bind || suspend;
    if (bind && !BUILD_PATTERN.test(requested)) throw new Error("bind_requires_public_build_uuid");
    if (suspend && !PENDING_PATTERN.test(requested)) throw new Error("suspend_requires_unique_pending_sentinel");
    atomicPairWrite(sourcePath, configPath, bindBuildText(sourceText, configText, requested));
    console.log(JSON.stringify({ ok: true, action: bind ? "bind" : "suspend", previous: current, expectedBuild: requested }, null, 2));
    return;
  }
  if (process.argv.includes("--source-only")) {
    console.log(JSON.stringify({ ok: true, source: sourcePath, config: configPath, expectedBuild: current }, null, 2));
    return;
  }
  if (process.argv.includes("--verify-public")) {
    if (!BUILD_PATTERN.test(current)) throw new Error("public_verification_blocked_while_suspended");
    const report = await verifyPublicAlignment({
      baseUrl: option("--base-url") || process.env.VII_PUBLIC_BASE_URL || "https://vii.spaplus.co",
      expectedBuild: current,
      warmHeaderBudgetMs: Number(option("--warm-header-budget-ms") || process.env.VII_EDGE_WARM_HEADER_BUDGET_MS || 1500),
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
    return;
  }
  throw new Error("release_alignment_mode_required");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => { console.error(`VII_RELEASE_ALIGNMENT_BLOCKED: ${error instanceof Error ? error.message : "unknown"}`); process.exitCode = 1; });
}

