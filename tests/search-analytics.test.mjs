import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSearchDemandEvent, parseSearchEvent, opportunityIdentity, saveSearchEvent } from "../app/lib/search-analytics.ts";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { POST } from "../app/api/analytics/search/route.ts";
import { GET } from "../app/api/admin/search-analytics/route.ts";

const eventId = "d5e63378-217c-4c08-9f62-7bccb8b4fd2e";

test("search event normalizes unknown free text without keeping personal input", () => {
  assert.deepEqual(parseSearchEvent({ eventId, world: "spa", location: "מרכז", hasDate: true }), { eventId, world: "spa", location: "מרכז", hasDate: true });
  assert.equal(parseSearchEvent({ eventId, world: "spa", location: "name@example.com", hasDate: true })?.location, "אחר");
  assert.equal(parseSearchEvent({ eventId, world: "invalid", location: "מרכז", hasDate: true }), null);
});

test("detailed search demand keeps bounded filters and creates a clean stable opportunity", async () => {
  const parsed = parseSearchDemandEvent({ eventId, sessionId: "a5e63378-217c-4c08-9f62-7bccb8b4fd2e", world: "events", location: "חיפה והכרמל", hasDate: false,
    pagePath: "/events/search?eventType=%D7%90%D7%99%D7%A8%D7%95%D7%A2+%D7%9E%D7%A9%D7%A4%D7%97%D7%AA%D7%99&location=%D7%97%D7%99%D7%A4%D7%94+%D7%95%D7%94%D7%9B%D7%A8%D7%9E%D7%9C",
    resultCount: 2, filters: { eventType: "אירוע משפחתי", ignored: "secret@example.com" } });
  assert.equal(parsed?.filters.eventType, "אירוע משפחתי");
  assert.equal("ignored" in (parsed?.filters || {}), false);
  assert.equal((await opportunityIdentity(parsed)).proposedPath, "/find/events-haifa-carmel-family-event");
});

test("opportunity demand is idempotent for a repeated event id", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const migration = fs.readFileSync(new URL("../drizzle/0006_search_intelligence.sql", import.meta.url), "utf8").replaceAll("--> statement-breakpoint", "");
  sqlite.exec(migration);
  sqlite.exec("CREATE TABLE vii_search_events (event_id TEXT PRIMARY KEY, world TEXT, location TEXT, has_date INTEGER, internal INTEGER, created_at TEXT)");
  const db = { prepare(sql) { let values = []; return { bind(...next) { values = next; return this; }, async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; }, async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); } };
  const parsed = parseSearchDemandEvent({ eventId, sessionId: "a5e63378-217c-4c08-9f62-7bccb8b4fd2e", world: "events", location: "חיפה והכרמל", hasDate: false, pagePath: "/events/search?eventType=family", resultCount: 2, filters: { eventType: "אירוע משפחתי" } });
  await saveSearchEvent(db, parsed, false); await saveSearchEvent(db, parsed, false);
  const row = sqlite.prepare("SELECT search_count AS count, latest_result_count AS results FROM vii_search_page_opportunities").get();
  assert.equal(row.count, 1);
  assert.equal(row.results, 2);
});

test("administrator search is retained as a separate test opportunity without increasing public demand", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const migration = fs.readFileSync(new URL("../drizzle/0006_search_intelligence.sql", import.meta.url), "utf8").replaceAll("--> statement-breakpoint", "");
  sqlite.exec(migration);
  sqlite.exec("CREATE TABLE vii_search_events (event_id TEXT PRIMARY KEY, world TEXT, location TEXT, has_date INTEGER, internal INTEGER, created_at TEXT)");
  const db = { prepare(sql) { let values = []; return { bind(...next) { values = next; return this; }, async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; }, async batch(statements) { return Promise.all(statements.map((statement) => statement.run())); } };
  const parsed = parseSearchDemandEvent({ eventId, sessionId: "a5e63378-217c-4c08-9f62-7bccb8b4fd2e", world: "spa", location: "מרכז", hasDate: false, pagePath: "/spas/search/center", resultCount: 4, filters: { experience: "pool" } });
  await saveSearchEvent(db, parsed, true);
  const opportunity = sqlite.prepare("SELECT search_count AS publicCount, latest_result_count AS results FROM vii_search_page_opportunities").get();
  const demand = sqlite.prepare("SELECT internal FROM vii_search_demand_events").get();
  assert.equal(opportunity.publicCount, 0);
  assert.equal(opportunity.results, 4);
  assert.equal(demand.internal, 1);
});

test("all four commercial result families emit detailed demand events", () => {
  const files = [
    fs.readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/events/search/page.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/components/world-map-results.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../app/components/hourly-results.tsx", import.meta.url), "utf8"),
  ];
  for (const [index, world] of ["vacation", "events", "spa", "hourly"].entries()) {
    assert.match(files[index], /trackSearchResults/);
    assert.match(files[index], new RegExp(`world:\\s*["']${world}["']`));
  }
});

test("search ingestion rejects cross-origin and malformed requests before storage", async () => {
  const url = "https://vii.spaplus.co/api/analytics/search";
  const crossOrigin = await POST(new Request(url, { method: "POST", headers: { origin: "https://foreign.example" }, body: "{}" }));
  assert.equal(crossOrigin.status, 403);
  const invalid = await POST(new Request(url, { method: "POST", headers: { origin: "https://vii.spaplus.co" }, body: JSON.stringify({ eventId, world: "spa", location: "מרכז" }) }));
  assert.equal(invalid.status, 400);
});

test("search report is restricted to administrators", async () => {
  const response = await GET(new Request("https://vii.spaplus.co/api/admin/search-analytics?days=7"));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});
