import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { incidentTransition, qualityHeartbeatWindow, qualityNotificationProviderStatus, qualityRegistry, readQualityDashboard, runQualityChecks, shouldStartQualityHeartbeat } from "../app/lib/quality-platform.ts";

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

const success = async (url) => {
  if (url.includes("/api/")) return Response.json({ world: url.includes("events") ? "events" : url.includes("rooms") ? "rooms" : url.includes("spa") ? "spa" : "vacations", entries: [{ id: "vacation-1" }], prices: {}, review: null, authenticated: false, reviews: [], items: [], slider: [], section: [], popular: [], cities: [], types: [], capabilities: {}, coordinatesReady: true, interactiveMap: true });
  if (url.endsWith("/sitemap.xml")) return new Response("<?xml version=\"1.0\"?><sitemapindex><sitemap><loc>https://example.test/sitemaps/core/1.xml</loc></sitemap><sitemap><loc>https://example.test/sitemaps/vacations/1.xml</loc></sitemap>" + "x".repeat(500) + "</sitemapindex>", { status: 200, headers: { "content-type": "application/xml" } });
  if (url.endsWith(".xml")) return new Response("<?xml version=\"1.0\"?><urlset><loc>https://example.test/</loc>" + "x".repeat(1_200) + "</urlset>", { status: 200, headers: { "content-type": "application/xml" } });
  const tokens = ["<main", "discovery-card", "results-list", "חיפוש", "נופש", "property-gallery", "tel:", "חוות דעת", "מיקום", "וואטסאפ", "אירועים", "חדרים לפי שעה", "ספא", "חבילות", "אטרקציות", "event-booking", "טיולים", "ספקים", "חגים", "רגע האחרון", "שאלות", "מצטרפים", "פרסום עסק", "תקנון", "פרטיות"];
  const locale = new URL(url).pathname.match(/^\/(en|fr|ru)(?:\/|$)/)?.[1] || "he";
  return new Response(`<!doctype html><html lang="${locale}"><head><link rel="alternate" hreflang="${locale}"></head><body>${tokens.join(" ")}${"x".repeat(3_000)}</body></html>`, { status: 200, headers: { "content-type": "text/html" } });
};

test("recurring registry is comprehensive, read-only and excludes accessibility and typography audits", () => {
  assert.ok(qualityRegistry.length >= 30);
  assert.equal(new Set(qualityRegistry.map((check) => check.checkId)).size, qualityRegistry.length);
  for (const check of qualityRegistry) {
    assert.ok(check.route.startsWith("/"));
    assert.doesNotMatch(`${check.checkId} ${check.family}`, /accessibility|typography/i);
    assert.ok(check.cadenceMinutes >= 5);
  }
  assert.equal(qualityRegistry.find((check) => check.checkId === "world.vacations.semantic")?.route, "/search");
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "world.vacations.semantic")?.requiredAll, ["<main", "results-list"]);
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "search.location.semantic")?.requiredAll, ["<main", "results-list"]);
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "api.home.presentation")?.requiredAll, ["\"popular\":", "\"cities\":", "\"types\":"]);
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "api.reviews.read")?.requiredAll, ["\"review\":", "\"authenticated\":"]);
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "content.contact")?.requiredAny, ["מצטרפים", "פרסום עסק"]);
  assert.equal(qualityRegistry.find((check) => check.checkId === "seo.sitemap.xml")?.minBytes, 500);
  assert.deepEqual(qualityRegistry.find((check) => check.checkId === "seo.sitemap.xml")?.requiredAll, ["<sitemapindex", "<loc>"]);
  assert.ok(qualityRegistry.filter((check) => check.family === "maps").length >= 4);
  assert.ok(new Set(qualityRegistry.map((check) => check.family)).size >= 10);
});

test("visitor heartbeat uses a stable five-minute bucket and cannot recurse", () => {
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

test("scheduled tick runs only the due risk-tier probes", async () => {
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

test("semantic checks reject generic HTML and map snapshots reject non-images", async () => {
  const { sqlite, db } = fixture();
  try {
    const generic = async (url) => url.includes("/api/map-health")
      ? Response.json({ coordinatesReady: false, interactiveMap: false })
      : url.includes("/api/") ? Response.json({ ok: true })
        : new Response(`<!doctype html><html><body>${"x".repeat(3_000)}</body></html>`, { status: 200, headers: { "content-type": "text/html" } });
    const result = await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", fetcher: generic, actor: "semantic-negative" });
    assert.equal(result.status, "failed");
    const dashboard = await readQualityDashboard(db);
    assert.ok(dashboard.incidents.some((incident) => incident.checkId === "map.snapshot.vacation"));
    assert.ok(dashboard.incidents.some((incident) => incident.checkId === "global.home.semantic"));
  } finally { sqlite.close(); }
});

test("quality runs use bounded concurrency and close abandoned running records", async () => {
  const { sqlite, db } = fixture();
  try {
    await runQualityChecks(db, { origin: "https://example.test", trigger: "scheduled", scheduledAt: new Date("2026-10-24T09:10:00.000Z"), fetcher: success });
    sqlite.prepare(`INSERT INTO quality_runs (id,operation_key,trigger_kind,status,started_at,passed_count,failed_count,degraded_count,blocked_count)
      VALUES ('stale-run','stale-operation','scheduled','running','2026-10-24T08:00:00.000Z',0,0,0,0)`).run();
    let active = 0; let maximum = 0;
    const bounded = async (url, options) => {
      active += 1; maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      try { return await success(url, options); } finally { active -= 1; }
    };
    const result = await runQualityChecks(db, { origin: "https://example.test", trigger: "manual", scheduledAt: new Date("2026-10-24T09:20:00.000Z"), fetcher: bounded });
    assert.equal(result.status, "passed");
    assert.ok(maximum > 1 && maximum <= 6, `expected bounded concurrency, observed ${maximum}`);
    const stale = sqlite.prepare("SELECT status,finished_at,blocked_count FROM quality_runs WHERE id='stale-run'").get();
    assert.equal(stale.status, "blocked");
    assert.ok(stale.finished_at);
    assert.equal(stale.blocked_count, 1);
  } finally { sqlite.close(); }
});

test("notification provider fails closed until every verified Resend setting exists", () => {
  assert.equal(qualityNotificationProviderStatus({}), "not_configured");
  assert.equal(qualityNotificationProviderStatus({ VII_QUALITY_EMAIL_PROVIDER: "smtp" }), "unsupported_provider");
  assert.equal(qualityNotificationProviderStatus({ VII_QUALITY_EMAIL_PROVIDER: "resend", VII_QUALITY_EMAIL_API_KEY: "secret" }), "incomplete_configuration");
  assert.equal(qualityNotificationProviderStatus({
    VII_QUALITY_EMAIL_PROVIDER: "resend", VII_QUALITY_EMAIL_API_KEY: "secret",
    VII_QUALITY_EMAIL_FROM: "VII QA <qa@example.test>", VII_QUALITY_EMAIL_RECIPIENTS: "adir@example.test,liran@example.test",
  }), "configured");
});
