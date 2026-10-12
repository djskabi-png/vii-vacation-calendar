import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { catalogStatusMcp } from "../app/lib/catalog-status-mcp.ts";

const origin = "https://vii.spaplus.co";
const identity = { "oai-authenticated-user-id": "test-owner", "oai-authenticated-user-email": "owner@example.test" };
function request(method, params = {}, headers = {}, id = 1) {
  return new Request(`${origin}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, params }) });
}
function dependencies() {
  const queries = [];
  return {
    queries,
    fallbackCounts: { vacations: 573, events: 129, rooms: 4, spa: 159 },
    adminEmails: async () => "owner@example.test",
    database: async () => ({ prepare(sql) {
      assert.match(sql, /^SELECT /);
      assert.match(sql, /FROM supplier_catalog_state/);
      assert.doesNotMatch(sql, /supplier_catalog_runs|supplier_catalog_entries/);
      let world;
      return { bind(value) { world = value; return this; }, async first() {
        queries.push(world);
        return world === "spa" ? { activeRunId: "private-run-id", activeCount: 159, acceptedAt: "private-date" } : null;
      } };
    } }),
  };
}

test("MCP initialization and discovery contain one read-only tool and never read configuration or D1", async () => {
  const deps = dependencies();
  deps.adminEmails = async () => { throw new Error("Configuration must not be read for discovery"); };
  deps.database = async () => { throw new Error("D1 must not be read for discovery"); };
  for (const version of ["2025-11-25", "2025-06-18", "2025-03-26"]) {
    const value = await (await catalogStatusMcp(request("initialize", { protocolVersion: version }), deps)).json();
    assert.equal(value.result.protocolVersion, version);
  }
  const value = await (await catalogStatusMcp(request("tools/list"), deps)).json();
  assert.equal(value.result.tools.length, 1);
  assert.equal(value.result.tools[0].name, "vii_catalog_status");
  assert.equal(value.result.tools[0].annotations.readOnlyHint, true);
  assert.deepEqual(await (await catalogStatusMcp(request("ping"), deps)).json(), { jsonrpc: "2.0", id: 1, result: {} });
  const initialized = new Request(`${origin}/mcp`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
  assert.equal((await catalogStatusMcp(initialized, deps)).status, 202);
});

test("anonymous calls, partial identity, cookies and service bearer alone cannot read MCP status", async () => {
  for (const headers of [{}, { "oai-authenticated-user-id": "test-owner" },
    { "oai-authenticated-user-email": "owner@example.test" },
    { Authorization: "Bearer test-only-value", "OAI-Sites-Authorization": "Bearer test-only-value", Cookie: "vii_session=test-only" }]) {
    const deps = dependencies();
    const response = await catalogStatusMcp(request("tools/call", { name: "vii_catalog_status" }, headers), deps);
    assert.equal(response.status, 401);
    assert.equal(deps.queries.length, 0);
    assert.doesNotMatch(JSON.stringify(await response.json()), /catalogs|count|test-only|owner@example/);
  }
});

test("a Sites identity outside the existing administrator allowlist is denied before D1", async () => {
  const deps = dependencies();
  const response = await catalogStatusMcp(request("tools/call", { name: "vii_catalog_status" },
    { ...identity, "oai-authenticated-user-email": "visitor@example.test" }), deps);
  assert.equal(response.status, 403);
  assert.equal(deps.queries.length, 0);
});

test("empty or unavailable authorization fails closed without returning exception values", async () => {
  for (const fail of [false, true]) {
    const deps = dependencies();
    deps.adminEmails = async () => { if (fail) throw new Error("private-key owner@example.test"); return ""; };
    const response = await catalogStatusMcp(request("tools/call", { name: "vii_catalog_status" }, identity), deps);
    assert.equal(response.status, 403);
    assert.equal(deps.queries.length, 0);
    assert.doesNotMatch(JSON.stringify(await response.json()), /private|owner@example/);
  }
});

test("authorized MCP status performs only SELECTs and returns counts without identity or run details", async () => {
  const deps = dependencies();
  const response = await catalogStatusMcp(request("tools/call", { name: "vii_catalog_status", arguments: {} }, identity), deps);
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.result.structuredContent.callerAuthenticated, true);
  assert.equal(value.result.structuredContent.callerAuthorized, true);
  assert.equal(value.result.structuredContent.readOnly, true);
  assert.deepEqual(value.result.structuredContent.catalogs, [
    { world: "vacations", source: "bundled-fallback", count: 573 },
    { world: "events", source: "bundled-fallback", count: 129 },
    { world: "rooms", source: "bundled-fallback", count: 4 },
    { world: "spa", source: "runtime", count: 159 },
  ]);
  assert.deepEqual(deps.queries.sort(), ["events", "rooms", "spa", "vacations"]);
  assert.doesNotMatch(JSON.stringify(value), /private|owner@example|test-owner|acceptedAt|activeRunId|contact|token/);
});

test("unknown write tools and caller-supplied identity, SQL or world arguments cannot access D1", async () => {
  for (const params of [{ name: "vii_catalog_pull" }, { name: "vii_catalog_status", arguments: { world: "spa" } },
    { name: "vii_catalog_status", arguments: { sql: "DELETE FROM supplier_catalog_state" } },
    { name: "vii_catalog_status", arguments: { userId: "test-owner" } }]) {
    const deps = dependencies();
    const value = await (await catalogStatusMcp(request("tools/call", params, identity), deps)).json();
    assert.equal(value.error.code, -32602);
    assert.equal(deps.queries.length, 0);
  }
});

test("invalid origin, unsupported protocol, batches and malformed JSON are rejected", async () => {
  const deps = dependencies();
  assert.equal((await catalogStatusMcp(request("tools/list", {}, { Origin: "https://attacker.invalid" }), deps)).status, 403);
  assert.equal((await catalogStatusMcp(request("tools/list", {}, { "MCP-Protocol-Version": "unknown" }), deps)).status, 400);
  for (const body of ["not-json", "[]", JSON.stringify({ jsonrpc: "1.0", id: 1, method: "tools/list" })]) {
    const r = new Request(`${origin}/mcp`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    assert.equal((await catalogStatusMcp(r, deps)).status, 400);
  }
  assert.equal(deps.queries.length, 0);
});

test("status runtime failures return no secret messages and pulls stay behind the shared MCP authorization", async () => {
  const deps = dependencies();
  deps.database = async () => { throw new Error("private-token https://private.invalid user@example.test"); };
  const value = await (await catalogStatusMcp(request("tools/call", { name: "vii_catalog_status" }, identity), deps)).json();
  assert.equal(value.result.isError, true);
  assert.doesNotMatch(JSON.stringify(value), /private|user@example|https/);
  const route = await readFile(new URL("../app/mcp/route.ts", import.meta.url), "utf8");
  assert.match(route, /async pull\(world\)/);
  assert.match(route, /catalogStatusMcp\(request/);
  assert.doesNotMatch(route, /fetchCandidate|\.run\(|\.batch\(/);
});
