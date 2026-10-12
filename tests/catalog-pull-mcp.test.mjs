import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { catalogStatusMcp } from "../app/lib/catalog-status-mcp.ts";
import { pullCatalogSlot } from "../app/lib/catalog-pull-mcp.ts";
import { catalogPullSlot } from "../app/lib/supplier-catalog-schedule.ts";
import { runSupplierCatalogSync } from "../app/lib/supplier-catalog-sync.ts";
import { catalogResponse } from "../app/api/catalog/route.ts";

const identity = { "oai-authenticated-user-id": "fixture-owner", "oai-authenticated-user-email": "owner@example.test" };
function request(headers = {}, args = { world: "spa" }) {
  return new Request("https://vii.spaplus.co/mcp", { method: "POST", headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "vii_catalog_pull", arguments: args } }) });
}
function dependencies() {
  let pulls = 0, databases = 0;
  return { adminEmails: async () => "owner@example.test", fallbackCounts: { spa: 159, vacations: 573, events: 129, rooms: 4 },
    database: async () => { databases++; throw new Error("unexpected_database"); },
    pull: async (world) => { pulls++; return { world, status: "accepted", persisted: true }; },
    counts: () => ({ pulls, databases }) };
}

function modernRequest(method, params = {}, headers = {}) {
  const meta = { "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientInfo": { name: "fixture-cloud-task", version: "1.0" },
    "io.modelcontextprotocol/clientCapabilities": {} };
  return new Request("https://vii.spaplus.co/mcp", { method: "POST", headers: { "Content-Type": "application/json",
    "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": method,
    ...(method === "tools/call" ? { "Mcp-Name": params.name } : {}), ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: { _meta: meta, ...params } }) });
}

test("modern platform discovery supports the observed protocol without private reads", async () => {
  const deps = dependencies();
  deps.adminEmails = async () => { throw new Error("Discovery must not inspect administrator secrets"); };
  const discover = await (await catalogStatusMcp(modernRequest("server/discover"), deps)).json();
  assert.equal(discover.result.resultType, "complete");
  assert.equal(discover.result.supportedVersions[0], "2026-07-28");
  assert.equal(discover.result._meta["io.modelcontextprotocol/serverInfo"].version, "1.1.0");
  assert.equal(discover.result.cacheScope, "public");
  const list = await (await catalogStatusMcp(modernRequest("tools/list"), deps)).json();
  assert.deepEqual(list.result.tools.map((t) => t.name), ["vii_catalog_status", "vii_catalog_pull"]);
  assert.equal(list.result.resultType, "complete"); assert.equal(list.result.ttlMs, 0);
  assert.deepEqual(deps.counts(), { pulls: 0, databases: 0 });
});

test("modern metadata supplies protocol context, never administrator identity", async () => {
  const deps = dependencies();
  const response = await catalogStatusMcp(modernRequest("tools/call", { name: "vii_catalog_pull",
    arguments: { world: "spa" }, _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { name: "owner@example.test", version: "1", userId: "fixture-owner" },
      "io.modelcontextprotocol/clientCapabilities": {} } }), deps);
  assert.equal(response.status, 401); assert.deepEqual(deps.counts(), { pulls: 0, databases: 0 });
  const value = await (await catalogStatusMcp(modernRequest("tools/call", { name: "vii_catalog_pull", arguments: { world: "spa" } }, identity), deps)).json();
  assert.equal(value.result.resultType, "complete"); assert.equal(deps.counts().pulls, 1);
});

test("modern header mismatches and missing per-request metadata fail before a pull", async () => {
  for (const [params, headers] of [[{ _meta: {} }, identity], [{}, { ...identity, "Mcp-Method": "server/discover" }],
    [{}, { ...identity, "Mcp-Name": "different-tool" }]]) {
    const deps = dependencies();
    const response = await catalogStatusMcp(modernRequest("tools/call", { name: "vii_catalog_pull", arguments: { world: "spa" }, ...params }, headers), deps);
    assert.equal(response.status, 400); assert.deepEqual(deps.counts(), { pulls: 0, databases: 0 });
  }
});

test("anonymous, service-only, partial identity and forged body/cookie identities cannot fetch or write", async () => {
  for (const headers of [{}, { Authorization: "Bearer fixture-service", "OAI-Sites-Authorization": "Bearer fixture-service" },
    { Cookie: "vii_session=fixture-owner", "X-User-Email": "owner@example.test" },
    { "oai-authenticated-user-id": "fixture-owner" }, { "oai-authenticated-user-email": "owner@example.test" }]) {
    const deps = dependencies();
    const response = await catalogStatusMcp(request(headers, { world: "spa", email: "owner@example.test" }), deps);
    assert.equal(response.status, 401);
    assert.deepEqual(deps.counts(), { pulls: 0, databases: 0 });
  }
});

test("non-administrators and unavailable allowlists are denied before supplier and D1 access", async () => {
  for (const fail of ["visitor", "empty", "exception"]) {
    const deps = dependencies();
    if (fail === "empty") deps.adminEmails = async () => "";
    if (fail === "exception") deps.adminEmails = async () => { throw new Error("private-key"); };
    const response = await catalogStatusMcp(request({ ...identity,
      ...(fail === "visitor" ? { "oai-authenticated-user-email": "visitor@example.test" } : {}) }), deps);
    assert.equal(response.status, 403);
    assert.deepEqual(deps.counts(), { pulls: 0, databases: 0 });
    assert.doesNotMatch(JSON.stringify(await response.json()), /private-key/);
  }
});

test("a pull accepts only one known world, never IDs, dates, source, keys or force", async () => {
  for (const args of [null, {}, { world: "unknown" }, { world: "spa", force: true },
    { world: "spa", id: "caller-run" }, { world: "spa", token: "private-key" }, { world: "spa", source: "manual" }]) {
    const deps = dependencies();
    const value = await (await catalogStatusMcp(request(identity, args), deps)).json();
    assert.equal(value.error.code, -32602);
    assert.deepEqual(deps.counts(), { pulls: 0, databases: 0 });
  }
  const deps = dependencies();
  assert.equal((await (await catalogStatusMcp(request(identity), deps)).json()).result.structuredContent.persisted, true);
  assert.equal(deps.counts().pulls, 1);
});

test("pull discovery is non-private and failures do not return keys or supplier exceptions", async () => {
  const deps = dependencies();
  deps.pull = async () => { throw new Error("private-key https://provider.invalid/key user@example.test"); };
  const value = await (await catalogStatusMcp(request(identity), deps)).json();
  assert.equal(value.result.isError, true);
  assert.doesNotMatch(JSON.stringify(value), /private|https|user@example/);
});

test("server-side slots follow all twelve approved Israel times across summer and winter", () => {
  const slots = { vacations: ["05:00", "12:00", "17:00"], events: ["05:30", "12:30", "17:30"],
    rooms: ["06:00", "13:00", "18:00"], spa: ["06:30", "13:30", "18:30"] };
  for (const [month, offset] of [[1, 2], [7, 3]]) for (const [world, times] of Object.entries(slots)) {
    for (const slot of times) {
      const [hour, minute] = slot.split(":").map(Number);
      const date = new Date(Date.UTC(2026, month - 1, 15, hour - offset, minute));
      const run = catalogPullSlot(date, world);
      assert.equal(run.slot, slot);
      assert.equal(catalogPullSlot(new Date(date.getTime() + 60_000), world).id, run.id);
    }
    assert.equal(catalogPullSlot(new Date(Date.UTC(2026, month - 1, 15, 1, 0)), world), null);
  }
  assert.equal(catalogPullSlot(new Date(NaN), "spa"), null);
});

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const name of ["0002_sour_tigra", "0003_catalog_diagnostics"]) {
    const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
    for (const sql of source.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) sqlite.exec(sql);
  }
  const prepare = (sql) => {
    let values = [];
    return { bind(...args) { values = args; return this; },
      async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; } };
  };
  return { prepare, async batch(statements) {
    sqlite.exec("BEGIN");
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  }, close: () => sqlite.close() };
}
const now = () => new Date("2026-10-12T15:35:00Z");
const baseline = Array.from({ length: 20 }, (_, index) => ({ supplierId: index + 1,
  summary: { id: index + 1, title: `Fixture ${index}`, image: `https://www.spaplus.co.il/gallery/${index}.jpg`,
    gallery: [`https://www.spaplus.co.il/gallery/${index}.jpg`], packages: [] } }));

test("a safe Spa slot persists one guarded generation and is visible through the public catalog", async () => {
  const db = await database(); let fetches = 0;
  const sync = (id, world) => runSupplierCatalogSync(db, { id, world, source: "scheduled", baseline, now,
    fetchCandidate: async () => { fetches++; return { fetchedAt: now().toISOString(), entries: baseline }; } });
  try {
    const first = await pullCatalogSlot(db, "spa", { sync, now });
    const second = await pullCatalogSlot(db, "spa", { sync, now });
    assert.equal(first.status, "accepted"); assert.equal(first.activeGenerationMatchesRun, true);
    assert.equal(second.repeated, true); assert.equal(second.id, first.id); assert.equal(fetches, 1);
    const publicData = await (await catalogResponse(new Request("https://vii.spaplus.co/api/catalog?world=spa"), db)).json();
    assert.equal(publicData.source, "runtime"); assert.equal(publicData.entries.length, 20);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM supplier_catalog_runs").first()).n, 1);
  } finally { db.close(); }
});

test("a rejected coverage collapse remains rejected and repeated calls never refetch or activate it", async () => {
  const db = await database(); let fetches = 0;
  const sync = (id, world) => runSupplierCatalogSync(db, { id, world, source: "scheduled", baseline, now,
    fetchCandidate: async () => { fetches++; return { fetchedAt: now().toISOString(), entries: baseline.slice(0, 10) }; } });
  try {
    const first = await pullCatalogSlot(db, "spa", { sync, now });
    const second = await pullCatalogSlot(db, "spa", { sync, now });
    assert.equal(first.status, "rejected"); assert.equal(first.errorCode, "catalog_removal_requires_review");
    assert.equal(second.repeated, true); assert.equal(fetches, 1); assert.equal(first.activeGenerationMatchesRun, false);
    assert.equal((await db.prepare("SELECT active_run_id AS id FROM supplier_catalog_state WHERE world = 'spa'").first()).id, null);
  } finally { db.close(); }
});

test("concurrent calls fetch only once and failed slots cannot be retried automatically", async () => {
  const db = await database(); let fetches = 0;
  const sync = (id, world) => runSupplierCatalogSync(db, { id, world, source: "scheduled", baseline, now,
    fetchCandidate: async () => { fetches++; throw new Error("private-provider-key"); } });
  try {
    await Promise.all([pullCatalogSlot(db, "spa", { sync, now }), pullCatalogSlot(db, "spa", { sync, now })]);
    const repeat = await pullCatalogSlot(db, "spa", { sync, now });
    assert.equal(repeat.status, "failed"); assert.equal(repeat.repeated, true); assert.equal(fetches, 1);
    assert.doesNotMatch(JSON.stringify(repeat), /private-provider-key/);
  } finally { db.close(); }
});
