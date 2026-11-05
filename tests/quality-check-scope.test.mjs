import assert from "node:assert/strict";
import test from "node:test";
import { qualityRegistry } from "../app/lib/quality-platform.ts";
import { adaptQualityChecks, selectQualityScope } from "../app/lib/quality-check-scope.ts";

const metadata = {
  "world.vacations.semantic": { definitionVersion: "1", boxIds: ["world.vacations"], requirementIds: ["A02"], engine: "http", depth: "regular", costBudgetMs: 1000, dependencies: [] },
  "search.location.semantic": { definitionVersion: "1", boxIds: ["search"], requirementIds: ["A10"], engine: "http", depth: "medium", costBudgetMs: 2000, dependencies: ["world.vacations.semantic"] },
};

test("adapter preserves every existing registry check and marks unmapped checks unsupported", () => {
  const adapted = adaptQualityChecks(qualityRegistry, metadata);
  assert.equal(adapted.length, qualityRegistry.length);
  assert.equal(adapted.find((check) => check.checkId === "world.vacations.semantic")?.unsupported, false);
  assert.equal(adapted.filter((check) => check.unsupported).length, qualityRegistry.length - 2);
  assert.equal(adapted.find((check) => check.checkId === "world.vacations.semantic")?.definitionVersion, "1");
});

test("changed box selection includes transitive consumers", () => {
  const adapted = adaptQualityChecks(qualityRegistry, metadata);
  const result = selectQualityScope(adapted, ["world.vacations"]);
  assert.equal(result.status, "selected");
  assert.deepEqual(result.selectedCheckIds, ["world.vacations.semantic", "search.location.semantic"]);
});

test("unknown owner selects broad scope and never returns empty green coverage", () => {
  const adapted = adaptQualityChecks(qualityRegistry, metadata);
  const result = selectQualityScope(adapted, [], { unknownOwner: true });
  assert.equal(result.status, "unmapped");
  assert.equal(result.checks.length, qualityRegistry.length);
  assert.match(result.reasons[0], /broad_coverage/);
});

test("empty or unknown scope is explicitly unmapped", () => {
  const adapted = adaptQualityChecks(qualityRegistry, metadata);
  assert.equal(selectQualityScope(adapted, []).status, "unmapped");
  assert.match(selectQualityScope(adapted, []).reasons[0], /empty_scope/);
  const unknownBox = selectQualityScope(adapted, ["not-a-server-box"]);
  assert.equal(unknownBox.status, "unmapped");
  assert.match(unknownBox.reasons[0], /unknown_boxes/);
});

test("unknown consumer ids cannot be treated as a selected partial run", () => {
  const adapted = adaptQualityChecks(qualityRegistry, metadata);
  const result = selectQualityScope(adapted, ["world.vacations"], { consumers: ["client.injected.check"] });
  assert.equal(result.status, "unmapped");
  assert.match(result.reasons[0], /unknown_consumers/);
});

test("unknown dependency and cycles fail closed", () => {
  const adapted = adaptQualityChecks(qualityRegistry.slice(0, 2), {
    "global.home.semantic": { definitionVersion: "1", boxIds: ["home"], requirementIds: ["A01"], engine: "http", depth: "regular", costBudgetMs: 1, dependencies: ["missing"] },
    "global.home.en.semantic": { definitionVersion: "1", boxIds: ["shell"], requirementIds: ["A01"], engine: "http", depth: "regular", costBudgetMs: 1, dependencies: ["global.home.semantic"] },
  });
  assert.equal(selectQualityScope(adapted, ["home"]).status, "invalid_graph");
  const cycle = adaptQualityChecks(qualityRegistry.slice(0, 2), {
    "global.home.semantic": { ...metadata["world.vacations.semantic"], boxIds: ["home"], dependencies: ["global.home.en.semantic"] },
    "global.home.en.semantic": { ...metadata["world.vacations.semantic"], boxIds: ["shell"], dependencies: ["global.home.semantic"] },
  });
  assert.equal(selectQualityScope(cycle, ["home"]).status, "invalid_graph");
});
