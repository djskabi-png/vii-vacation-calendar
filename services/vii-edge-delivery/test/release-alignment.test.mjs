import assert from "node:assert/strict";
import test from "node:test";
import { bindBuildText, readSourceBuilds, validateSourceAlignment, verifyPublicAlignment } from "../scripts/release-alignment.mjs";

const oldBuild = "11111111-2222-3333-4444-555555555555";
const nextBuild = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const source = value => `const EXPECTED_BUILD = "${value}";\n`;
const config = value => `[vars]\nEXPECTED_BUILD = "${value}"\n`;

test("source and Wrangler configuration must agree exactly", () => {
  assert.equal(validateSourceAlignment(source(oldBuild), config(oldBuild)), oldBuild);
  assert.deepEqual(readSourceBuilds(source(oldBuild), config(oldBuild)), { source: oldBuild, config: oldBuild });
  assert.throws(() => validateSourceAlignment(source(oldBuild), config(nextBuild)), /edge_source_config_mismatch/);
});

test("binding changes both expected-build definitions atomically in memory", () => {
  const next = bindBuildText(source(oldBuild), config(oldBuild), nextBuild);
  assert.equal(validateSourceAlignment(next.source, next.config), nextBuild);
  assert.throws(() => bindBuildText(source(oldBuild), config(nextBuild), nextBuild), /edge_source_config_mismatch/);
});

test("a unique pending sentinel suspends admission but arbitrary values fail", () => {
  const pending = "pending-v900-20261112";
  const next = bindBuildText(source(oldBuild), config(oldBuild), pending);
  assert.equal(validateSourceAlignment(next.source, next.config), pending);
  assert.throws(() => bindBuildText(source(oldBuild), config(oldBuild), "pending"), /requested_build_invalid/);
});

function response(build, { delivery = "HIT", status = 200, skip = "" } = {}) {
  return new Response("<html>VII</html>", { status, headers: {
    "Content-Type": "text/html", "X-VII-App-Build": build, "X-VII-Cache-Build": build,
    "X-VII-Edge-Delivery": delivery, ...(skip ? { "X-VII-Edge-Cache-Skip": skip } : {}),
  }});
}

test("public verification accepts only matching warm HIT documents", async () => {
  let calls = 0;
  const report = await verifyPublicAlignment({ expectedBuild: oldBuild, routes: ["/", "/events"],
    fetcher: async () => response(oldBuild, { delivery: ++calls % 2 ? "MISS" : "HIT" }) });
  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
});

test("public verification fails closed on stale build, skip and non-HIT warm response", async () => {
  const replies = [response(nextBuild, { delivery: "MISS", skip: "build_mismatch" }), response(nextBuild, { delivery: "MISS", skip: "build_mismatch" })];
  const report = await verifyPublicAlignment({ expectedBuild: oldBuild, routes: ["/"], fetcher: async () => replies.shift() });
  assert.equal(report.ok, false);
  assert.ok(report.failures.includes("/:observed_build_mismatch"));
  assert.ok(report.failures.includes("/:edge_build_mismatch"));
  assert.ok(report.failures.includes("/:warm_delivery:MISS"));
});

