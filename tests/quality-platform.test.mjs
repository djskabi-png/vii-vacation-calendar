import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { incidentTransition, qualityHeartbeatWindow, qualityRegistry, readQualityDashboard, runQualityChecks, shouldStartQualityHeartbeat } from "../app/lib/quality-platform.ts";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  const db = {
    prepare(sql) {
      let args = [];
      const statement = {
        bind(...values) { args = values; return statement; },
        async first() { return sqlite.prepare(sql).get(...args) || null; },
        async all() { return { success: true, results: sqlite.prepare(sql).all(...args) }; },
        async run() { const result = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } }; },
      };
      return statement;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try { const output = []; for (const statement of statements) output.push(await statement.run()); sqlite.exec("COMMIT"); return output; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  return { sqlite, db };
}

const success = async (url) => new Response(url.endsWith(".xml") ? "<?xml version=\"1.0\"?><urlset>" + "x".repeat(300) + "</urlset>" : "<!doctype html><html><body>" + "x".repeat(300) + "</body></html>", { status: 200, headers: { "content-type": url.endsWith(".xml") ? "application/xml" : "text/html" } });

test("recurring registry is read-only and excludes accessibility and typography audits", () => {
  assert.ok(qualityRegistry.length >= 8);
  assert.equal(new Set(qualityRegistry.map((check) => check.checkId)).size, qualityRegistry.length);
  for (const check of qualityRegistry) {
    assert.ok(check.route.startsWith("/"));
    assert.doesNotMatch(`${check.checkId} ${check.family}`, /accessibility|typography/i);
    assert.ok(check.cadenceMinutes >= 10);
  }
  assert.equal(qualityRegistry.find((check) => check.checkId === "world.vacations.html")?.route, "/search");
});

test("visitor heartbeat uses a stable ten-minute bucket and cannot recurse", () => {
  assert.equal(qualityHeartbeatWindow(new Date("2026-10-23T18:53:42.000Z")).toISOString(), "2026-10-23T18:50:00.000Z");
  assert.equal(shouldStartQualityHeartbeat(new Request("https://vii.spaplus.co/", {
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Mozilla/5.0" },
  })), true);
  assert.equal(shouldStartQualityHeartbeat(new Request("https://vii.spaplus.co/", {
    headers: { accept: "text/html", "user-agent": "VII-Quality-Monitor/1.0" },
  })), false);
  assert.equal(shouldStartQualityHeartbeat(new Request("https://vii.spaplus.co/api/admin/quality", {
    method: "POST", headers: { accept: "text/html" },
  })), false);
});

test("incident transition deduplicates repeated failures and recovers the same incident", () => {
  assert.deepEqual(incidentTransition(null, "failed"), { action: "open", occurrences: 1 });
  assert.deepEqual(incidentTransition({ status: "open", occurrences: 1 }, "failed"), { action: "update", occurrences: 2 });
  assert.deepEqual(incidentTransition({ status: "open", occurrences: 2 }, "passed"), { action: "recover", occurrences: 2 });
  assert.deepEqual(incidentTransition(null, "passed"), { action: "none", occurrences: 0 });
});

test("two identical failures open one incident, recovery resolves it, and email fails closed", async () => {
  const { sqlite, db } = fixture();
  try {
    const failing = async (url, options) => url.includes("/search?") ? new Response("failure".repeat(60), { status: 503, headers: { "content-type": "text/html" } }) : success(url, options);
    await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", fetcher: failing, actor: "test" });
    await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", fetcher: failing, actor: "test" });
    let dashboard = await readQualityDashboard(db);
    const open = dashboard.incidents.filter((incident) => incident.status === "open");
    assert.equal(open.length, 1);
    assert.equal(open[0].occurrences, 2);
    assert.equal(dashboard.deliveries.length, 1);
    assert.equal(dashboard.deliveries[0].status, "disabled");
    assert.equal(dashboard.deliveries[0].providerMessageId, null);
    sqlite.prepare("UPDATE quality_incidents SET fingerprint='legacy-route-config'").run();
    await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", fetcher: success, actor: "test" });
    dashboard = await readQualityDashboard(db);
    assert.equal(dashboard.incidents.length, 1);
    assert.equal(dashboard.incidents[0].status, "resolved");
    assert.ok(dashboard.incidents[0].recoveredAt);
    assert.equal(dashboard.deliveries.length, 2);
    assert.ok(dashboard.deliveries.every((delivery) => delivery.status === "disabled" && delivery.providerMessageId === null));
  } finally { sqlite.close(); }
});

test("scheduled ten-minute tick runs only the due critical probes", async () => {
  const { sqlite, db } = fixture();
  try {
    const scheduledAt = new Date("2026-10-23T10:10:00.000Z");
    const result = await runQualityChecks(db, { origin: "https://example.test", trigger: "scheduled", scheduledAt, fetcher: success });
    assert.equal(result.checkCount, qualityRegistry.filter((check) => 10 % check.cadenceMinutes === 0).length);
    assert.equal(result.status, "passed");
    const duplicate = await runQualityChecks(db, { origin: "https://example.test", trigger: "scheduled", scheduledAt, fetcher: async () => { throw new Error("duplicate must not fetch"); } });
    assert.equal(duplicate.status, "skipped");
    assert.equal(duplicate.runId, result.runId);
  } finally { sqlite.close(); }
});
