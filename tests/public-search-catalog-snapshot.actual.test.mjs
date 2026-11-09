import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { readPublicSearchCatalogSnapshot } from "../app/lib/public-search-catalog-snapshot.ts";
import { catalogResponse } from "../app/api/catalog/route.ts";
import { publicEventSearchPlaces } from "../app/lib/public-event-search.ts";
import { eventMatchesFeatureSelection } from "../app/lib/event-search-features.ts";

function makeDb({ count = 2, malformed = false, ids = [7001, 7002], invalidIds = false } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE supplier_catalog_state (world TEXT PRIMARY KEY, active_run_id TEXT, active_count INTEGER, accepted_at TEXT);
    CREATE TABLE supplier_catalog_entries (supplier_id INTEGER, run_id TEXT, world TEXT, summary_json TEXT);
    CREATE TABLE vii_content_items (id TEXT PRIMARY KEY, content_type TEXT, entity_key TEXT, world TEXT, locale TEXT, status TEXT, scheduled_at TEXT, version INTEGER, published_version INTEGER);
    CREATE TABLE vii_content_versions (item_id TEXT, version INTEGER, content_json TEXT);`);
  const run = "snapshot-run";
  sqlite.prepare("INSERT INTO supplier_catalog_state VALUES (?, ?, ?, ?)").run("events", run, count, "2026-11-08T00:00:00Z");
  for (const id of (invalidIds ? [0, 7002] : ids)) {
    const summary = JSON.stringify({ supplierId: id, world: "events", sourceUrl: `https://example.test/event-${id}`, name: `Supplier ${id}`, description: "תיאור", location: "צפון", area: "צפון", type: "לופט", slug: `event-${id}`, image: "/a.jpg", images: ["/a.jpg", "/b.jpg"], units: [{ id: `unit-${id}` }], guests: 20, lat: 32.1, lng: 34.8, features: [], audiences: [], badges: [], eventTypes: [] });
    sqlite.prepare("INSERT INTO supplier_catalog_entries VALUES (?, ?, ?, ?)").run(id, run, "events", malformed && id === 7002 ? "{" : summary);
  }
  const editorial = JSON.stringify({ title: "שם עריכתי", summary: "תיאור עריכתי", body: "", metaTitle: "", metaDescription: "", imageAlt: "", links: [], attributes: {} });
  sqlite.prepare("INSERT INTO vii_content_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("events:7001:he", "events", "7001", "events", "he", "published", null, 1, 1);
  sqlite.prepare("INSERT INTO vii_content_versions VALUES (?, ?, ?)").run("events:7001:he", 1, editorial);
  const db = {
    prepare(sql) {
      let args = [];
      const statement = { bind(...values) { args = values; return statement; }, async all() { return { results: sqlite.prepare(sql).all(...args) }; }, async first() { return sqlite.prepare(sql).get(...args) ?? null; } };
      return statement;
    },
    async batch(statements) {
      return Promise.all(statements.map((statement) => statement.all()));
    },
  };
  return { db, sqlite };
}

const request = () => new Request("https://vii.spaplus.co/api/catalog?world=events&view=search");

test("supplier description-only facilities survive display and editorial shortening without exposing raw marketing", async () => {
  const { db, sqlite } = makeDb();
  try {
    const raw = JSON.parse(sqlite.prepare("SELECT summary_json FROM supplier_catalog_entries WHERE supplier_id=7001").get().summary_json);
    raw.description = "אירועי חברה ומסיבות עם בר אלכוהול. מחיר שיווקי 1,999 שקלים";
    sqlite.prepare("UPDATE supplier_catalog_entries SET summary_json=? WHERE supplier_id=7001").run(JSON.stringify(raw));
    const snapshot = await readPublicSearchCatalogSnapshot(db, "events");
    const summary = snapshot.entries[0].summary;
    assert.ok(summary.features.includes("בר אלכוהול"));
    assert.equal(eventMatchesFeatureSelection(summary, "בר אלכוהול"), true);
    assert.equal(eventMatchesFeatureSelection(snapshot.entries[1].summary, "בר אלכוהול"), false);
    assert.ok(summary.eventTypes.includes("אירועי חברה"));
    assert.deepEqual(publicEventSearchPlaces([summary])[0], { ...summary, images: summary.images.slice(0, 5) }, "search projection is idempotent with bounded image metadata");
    const api = await (await catalogResponse(request(), db)).json();
    assert.deepEqual(api, JSON.parse(JSON.stringify(snapshot)));
    assert.equal(summary.description, "");
    assert.equal(JSON.stringify(api).includes("1,999"), false);
    assert.equal(Object.hasOwn(summary, "searchDescription"), false);
  } finally { sqlite.close(); }
});

test("runtime search snapshot and API share complete editorial projection and source identities", async () => {
  const { db, sqlite } = makeDb();
  try {
    const snapshot = await readPublicSearchCatalogSnapshot(db, "events");
    assert.ok(snapshot);
    assert.deepEqual(snapshot.entries.map((entry) => entry.supplierId), [7001, 7002]);
    assert.equal(snapshot.entries[0].summary.name, "שם עריכתי");
    assert.equal(snapshot.entries[0].summary.images.length, 2, "event search projection keeps bounded image metadata");
    const api = await (await catalogResponse(request(), db)).json();
    assert.equal(api.entries[0].summary.images.length, 2, JSON.stringify({ snapshot: snapshot.entries[0].summary, api: api.entries[0].summary }));
    assert.deepEqual(api, JSON.parse(JSON.stringify(snapshot)));
    assert.equal(api.entries[0].summary.name, "שם עריכתי");
    assert.equal(api.entries[0].summary.units.length, 1);
  } finally { sqlite.close(); }
});

test("vacation search API retains the same published management priority through the shared snapshot", async () => {
  const { db, sqlite } = makeDb();
  try {
    sqlite.exec("UPDATE supplier_catalog_state SET world='vacations'; UPDATE supplier_catalog_entries SET world='vacations';");
    for (const row of sqlite.prepare("SELECT supplier_id,summary_json FROM supplier_catalog_entries").all()) {
      const summary = { ...JSON.parse(row.summary_json), world: "vacations", slug: `vacation-${row.supplier_id}`, type: "צימר", curatedRank: 99 };
      sqlite.prepare("UPDATE supplier_catalog_entries SET summary_json=? WHERE supplier_id=?").run(JSON.stringify(summary), row.supplier_id);
    }
    sqlite.exec("UPDATE vii_content_items SET content_type='vacation',world='vacations';");
    const editorial = JSON.parse(sqlite.prepare("SELECT content_json FROM vii_content_versions").get().content_json);
    editorial.attributes.homeDealOrder = "13";
    sqlite.prepare("UPDATE vii_content_versions SET content_json=?").run(JSON.stringify(editorial));
    const snapshot = await readPublicSearchCatalogSnapshot(db, "vacations");
    assert.equal(snapshot.entries[0].summary.curatedRank, 13);
    assert.equal(snapshot.entries[1].summary.curatedRank, 99);
    const response = await catalogResponse(new Request("https://vii.spaplus.co/api/catalog?world=vacations&view=search"), db);
    assert.deepEqual(await response.json(), JSON.parse(JSON.stringify(snapshot)));
  } finally { sqlite.close(); }
});

test("invalid complete-generation evidence falls through without a false empty success", async () => {
  const { db, sqlite } = makeDb({ count: 3 });
  try {
    assert.equal(await readPublicSearchCatalogSnapshot(db, "events"), null);
    const response = await catalogResponse(request(), db);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.source, "bundled-fallback");
    assert.ok(body.entries.length > 0);
  } finally { sqlite.close(); }
});

test("malformed summary JSON cannot become a partial runtime search response", async () => {
  const { db, sqlite } = makeDb({ malformed: true });
  try {
    assert.equal(await readPublicSearchCatalogSnapshot(db, "events"), null);
    const body = await (await catalogResponse(request(), db)).json();
    assert.equal(body.source, "bundled-fallback");
    assert.ok(body.entries.length > 0);
  } finally { sqlite.close(); }
});

test("quarantined middle rows are filtered without losing their source identity", async () => {
  const { db, sqlite } = makeDb({ ids: [7001, 7002, 7003], count: 3 });
  try {
    sqlite.prepare("UPDATE supplier_catalog_entries SET summary_json = ? WHERE supplier_id = ?").run(JSON.stringify({ supplierId: 7002, world: "events", sourceUrl: "https://example.test/event-7002" }), 7002);
    const snapshot = await readPublicSearchCatalogSnapshot(db, "events");
    assert.ok(snapshot);
    assert.deepEqual(snapshot.entries.map((entry) => entry.supplierId), [7001, 7003]);
  } finally { sqlite.close(); }
});

test("invalid and duplicate supplier identities are rejected before projection", async () => {
  for (const options of [{ invalidIds: true, count: 2 }, { ids: [7001, 7001], count: 2 }]) {
    const { db, sqlite } = makeDb(options);
    try { assert.equal(await readPublicSearchCatalogSnapshot(db, "events"), null); }
    finally { sqlite.close(); }
  }
});
