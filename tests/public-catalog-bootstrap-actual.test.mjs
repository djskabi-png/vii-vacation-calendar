import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { readCatalogBootstrap, publicCatalogSummariesFromDatabase } from "../app/lib/public-catalog-read.ts";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE supplier_catalog_state (
    world TEXT PRIMARY KEY, active_run_id TEXT, active_count INTEGER, accepted_at TEXT
  );
  CREATE TABLE vii_content_items (
    id TEXT PRIMARY KEY, content_type TEXT, entity_key TEXT, world TEXT, locale TEXT,
    status TEXT, scheduled_at TEXT, version INTEGER, published_version INTEGER
  );
  CREATE TABLE vii_content_versions (
    item_id TEXT, version INTEGER, content_json TEXT
  );
  CREATE TABLE supplier_catalog_entries (
    supplier_id INTEGER, run_id TEXT, world TEXT, summary_json TEXT
  );`);
  const db = {
    batchCalls: 0,
    outsideBatchAllCalls: 0,
    summaryRowCounts: [],
    batchDepth: 0,
    failOverlay: false,
    prepare(sql) {
      let values = [];
      const statement = {
        bind(...next) { values = next; return statement; },
        async first() { return sqlite.prepare(sql).get(...values) ?? null; },
        async all() {
          if (db.failOverlay && sql.includes("vii_content_items")) throw new Error("overlay_read_failed");
          if (!db.batchDepth) db.outsideBatchAllCalls += 1;
          const results = sqlite.prepare(sql).all(...values);
          if (sql.includes('LEFT JOIN supplier_catalog_entries')) db.summaryRowCounts.push(results.filter(row => row.supplierId !== null).length);
          return { results };
        },
      };
      return statement;
    },
    async batch(statements) {
      db.batchCalls += 1;
      db.batchDepth += 1;
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.all()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      finally { db.batchDepth -= 1; }
    },
  };
  return { sqlite, db };
}

function content(title) {
  return JSON.stringify({ title, summary: "תקציר עריכתי מלא", body: "תוכן", metaTitle: title,
    metaDescription: "תיאור", imageAlt: "תמונה", links: [], attributes: {} });
}

function accept(sqlite, runId, ids, count = ids.length) {
  sqlite.prepare('INSERT OR REPLACE INTO supplier_catalog_state VALUES (?, ?, ?, ?)').run('events', runId, count, '2026-11-08T00:00:00Z');
  for (const id of ids) sqlite.prepare('INSERT INTO supplier_catalog_entries VALUES (?, ?, ?, ?)').run(id, runId, 'events', JSON.stringify({ supplierId: id, world: 'events', name: `Place ${id}`, description: 'מקום אירועים', location: 'מרכז', area: 'מרכז', slug: `event-${id}`, image: '/image.jpg', images: ['/image.jpg'] }));
}

test('warm accepted reader skips summary rows and still applies fresh editorial changes', async () => {
  const { sqlite, db } = database();
  try {
    accept(sqlite, 'reader-warm', [900001, 900002]);
    const first = await publicCatalogSummariesFromDatabase(db, 'events');
    assert.deepEqual(first.map(row => row.supplierId), [900001, 900002]);
    sqlite.prepare('INSERT INTO vii_content_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('events:900001:he', 'events', '900001', 'events', 'he', 'published', null, 1, 1);
    sqlite.prepare('INSERT INTO vii_content_versions VALUES (?, ?, ?)').run('events:900001:he', 1, content('עדכון מיידי'));
    const second = await publicCatalogSummariesFromDatabase(db, 'events');
    assert.equal(second[0].name, 'עדכון מיידי');
    assert.deepEqual(db.summaryRowCounts, [2, 0]);
    assert.equal(db.outsideBatchAllCalls, 0);
    assert.equal(db.batchCalls, 2);
  } finally { sqlite.close(); }
});

test('a changed accepted generation is read atomically despite a warm previous generation', async () => {
  const { sqlite, db } = database();
  try {
    accept(sqlite, 'reader-pointer-old', [900011, 900012]);
    await publicCatalogSummariesFromDatabase(db, 'events');
    accept(sqlite, 'reader-pointer-new', [900013]);
    const next = await publicCatalogSummariesFromDatabase(db, 'events');
    assert.deepEqual(next.map(row => row.supplierId), [900013]);
    assert.deepEqual(db.summaryRowCounts, [2, 1]);
    assert.equal(db.outsideBatchAllCalls, 0);
  } finally { sqlite.close(); }
});

test('an expired catalog reads complete rows again without another network round trip', async () => {
  const { sqlite, db } = database();
  const now = Date.now;
  try {
    accept(sqlite, 'reader-expiry', [900021]);
    const startedAt = now();
    await publicCatalogSummariesFromDatabase(db, 'events');
    Date.now = () => startedAt + 5 * 60_000 + 1000;
    const next = await publicCatalogSummariesFromDatabase(db, 'events');
    assert.deepEqual(next.map(row => row.supplierId), [900021]);
    assert.deepEqual(db.summaryRowCounts, [1, 1]);
    assert.equal(db.outsideBatchAllCalls, 0);
  } finally { Date.now = now; sqlite.close(); }
});

test('NULL, negative and fractional counts never authorize empty summaries; valid zero does', async () => {
  for (const count of [null, -1, 0.5, 0]) {
    const { sqlite, db } = database();
    try {
      accept(sqlite, `reader-count-${count}`, [], count);
      const result = await readCatalogBootstrap(db, 'events');
      if (count === 0) assert.deepEqual(result.summaries.entries, []);
      else assert.equal(result.summaries, undefined, String(count));
    } finally { sqlite.close(); }
  }
});

test('a partial generation is never served as complete by the optimized reader', async () => {
  const { sqlite, db } = database();
  try {
    accept(sqlite, 'reader-partial', [900031], 2);
    const result = await publicCatalogSummariesFromDatabase(db, 'events');
    assert.ok(!result.some(row => row.supplierId === 900031), 'partial accepted rows must not escape the established fallback');
    assert.equal(db.batchCalls, 1);
    assert.ok(db.outsideBatchAllCalls > 0, 'the original guarded summary reader remains the bounded fallback');
  } finally { sqlite.close(); }
});

test('invalid summary JSON and an overlay batch failure keep the existing bounded fallback', async () => {
  for (const failure of ['json', 'overlay']) {
    const { sqlite, db } = database();
    try {
      accept(sqlite, `reader-failure-${failure}`, [900041]);
      if (failure === 'json') sqlite.prepare('UPDATE supplier_catalog_entries SET summary_json = ?').run('{');
      else db.failOverlay = true;
      const result = await publicCatalogSummariesFromDatabase(db, 'events');
      if (failure === 'json') assert.ok(!result.some(row => row.supplierId === 900041));
      else assert.deepEqual(result.map(row => row.supplierId), [900041]);
      assert.equal(db.batchCalls, 1);
      assert.ok(db.outsideBatchAllCalls > 0);
    } finally { sqlite.close(); }
  }
});

test("catalog bootstrap batches state and overlays while preserving published predicates", async () => {
  const { sqlite, db } = database();
  try {
    sqlite.prepare("INSERT INTO supplier_catalog_state VALUES (?, ?, ?, ?)").run("vacations", "run-a", 2, "2026-11-08T00:00:00.000Z");
    sqlite.prepare("INSERT INTO vii_content_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("vacation:live:he", "vacation", "live", "vacations", "he", "published", null, 1, 1);
    sqlite.prepare("INSERT INTO vii_content_versions VALUES (?, ?, ?)").run("vacation:live:he", 1, content("חי"));
    sqlite.prepare("INSERT INTO vii_content_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("vacation:archived:he", "vacation", "archived", "vacations", "he", "archived", null, 1, 1);
    sqlite.prepare("INSERT INTO vii_content_versions VALUES (?, ?, ?)").run("vacation:archived:he", 1, content("ארכיון"));
    sqlite.prepare("INSERT INTO vii_content_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("vacation:future:he", "vacation", "future", "vacations", "he", "scheduled", "2999-01-01T00:00:00.000Z", 1, null);
    sqlite.prepare("INSERT INTO vii_content_versions VALUES (?, ?, ?)").run("vacation:future:he", 1, content("עתידי"));

    const result = await readCatalogBootstrap(db, "vacations");
    assert.equal(db.batchCalls, 1);
    assert.equal(db.outsideBatchAllCalls, 0, "cold summaries must not use a standalone read");
    assert.equal(result.state.activeRunId, "run-a");
    assert.deepEqual((await result.overlays).map((item) => item.key), ["live"]);
  } finally { sqlite.close(); }
});

test("overlay failure after batch falls back once and keeps state isolated", async () => {
  const { sqlite, db } = database();
  try {
    sqlite.prepare("INSERT INTO supplier_catalog_state VALUES (?, ?, ?, ?)").run("events", "run-e", 1, "2026-11-08T00:00:00.000Z");
    db.failOverlay = true;
    const result = await readCatalogBootstrap(db, "events");
    assert.equal(result.state.activeRunId, "run-e");
    assert.deepEqual(await result.overlays, []);
    assert.equal(db.batchCalls, 1);
  } finally { sqlite.close(); }
});

test("public catalog reader consumes complete same-generation summaries from the cold batch", async () => {
  const { sqlite, db } = database();
  try {
    sqlite.prepare("INSERT INTO supplier_catalog_state VALUES (?, ?, ?, ?)").run("events", "run-complete", 2, "2026-11-08T00:00:00.000Z");
    const summary = JSON.stringify({ supplierId: 1, world: "events", name: "מקום אירועים", description: "מקום אירועים במרכז", location: "מרכז", area: "מרכז", image: "https://example.test/a.jpg", images: ["https://example.test/a.jpg"], slug: "event-1" });
    sqlite.prepare("INSERT INTO supplier_catalog_entries VALUES (?, ?, ?, ?)").run(1, "run-complete", "events", summary);
    sqlite.prepare("INSERT INTO supplier_catalog_entries VALUES (?, ?, ?, ?)").run(2, "run-complete", "events", summary.replace("event-1", "event-2"));
    const result = await publicCatalogSummariesFromDatabase(db, "events");
    assert.equal(db.batchCalls, 1);
    assert.equal(db.outsideBatchAllCalls, 0, 'actual reader must not perform the former second summary round trip');
    assert.equal(result.length, 2);
  } finally { sqlite.close(); }
});

test("all four supplier worlds retain scheduled versions, locale boundaries, and fresh manual edits", async () => {
  for (const [world, type] of [["vacations", "vacation"], ["events", "events"], ["rooms", "hourly"], ["spa", "spa"]]) {
    const { sqlite, db } = database();
    try {
      sqlite.prepare("INSERT INTO supplier_catalog_state VALUES (?, ?, ?, ?)").run(world, "generation-a", 4, "2000-01-01T00:00:00Z");
      const add = (key, status, date, locale = "he", published = 1) => {
        const id = `${type}:${key}:${locale}`;
        sqlite.prepare("INSERT INTO vii_content_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, type, key, world, locale, status, date, 2, published);
        for (const version of [1, 2]) sqlite.prepare("INSERT INTO vii_content_versions VALUES (?, ?, ?)").run(id, version, content(`${key}-${version}`));
      };
      add("past", "scheduled", "2000-01-01T00:00:00Z");
      add("future", "scheduled", "2999-01-01T00:00:00Z");
      add("archived", "archived", null);
      add("draft", "draft", null, "he", null);
      add("english-only", "published", null, "en");
      const first = await readCatalogBootstrap(db, world);
      assert.equal(first.state.activeRunId, "generation-a", world);
      assert.deepEqual((await first.overlays).map(row => row.content.title), ["future-1", "past-2"], world);
      sqlite.prepare("UPDATE supplier_catalog_state SET active_run_id = ?, active_count = ? WHERE world = ?").run("generation-b", 7, world);
      sqlite.prepare("UPDATE vii_content_versions SET content_json = ? WHERE item_id = ? AND version = 2").run(content("fresh-manual-edit"), `${type}:past:he`);
      const second = await readCatalogBootstrap(db, world);
      assert.equal(second.state.activeRunId, "generation-b", world);
      assert.equal(second.state.activeCount, 7, world);
      assert.equal((await second.overlays).find(row => row.key === "past").content.title, "fresh-manual-edit", world);
      assert.equal(db.batchCalls, 2);
    } finally { sqlite.close(); }
  }
});

test("an overlay prepare failure remains isolated and adapters without batch retain their old path", async () => {
  const { sqlite, db } = database();
  try {
    sqlite.prepare("INSERT INTO supplier_catalog_state VALUES (?, ?, ?, ?)").run("vacations", "accepted", 1, "2000-01-01T00:00:00Z");
    const prepare = db.prepare;
    db.prepare = sql => { if (sql.includes("vii_content_items")) throw Error("overlay_prepare_failure"); return prepare(sql); };
    const first = await readCatalogBootstrap(db, "vacations");
    assert.equal(first.state.activeRunId, "accepted");
    assert.deepEqual(await first.overlays, []);
    assert.equal(db.batchCalls, 0);
    db.prepare = prepare;
    db.batch = undefined;
    const second = await readCatalogBootstrap(db, "vacations");
    assert.equal(second.state.activeRunId, "accepted");
    assert.deepEqual(await second.overlays, []);
  } finally { sqlite.close(); }
});

test("state failure does not discard readable editorial overlays or escape the bounded fallback", async () => {
  const { sqlite, db } = database();
  try {
    sqlite.exec("DROP TABLE supplier_catalog_state");
    sqlite.prepare("INSERT INTO vii_content_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("events:live:he", "events", "live", "events", "he", "published", null, 1, 1);
    sqlite.prepare("INSERT INTO vii_content_versions VALUES (?, ?, ?)").run("events:live:he", 1, content("preserved"));
    const result = await readCatalogBootstrap(db, "events");
    assert.equal(result.state, null);
    assert.ok(result.stateError);
    assert.deepEqual((await result.overlays).map(row => row.content.title), ["preserved"]);
    assert.equal(db.batchCalls, 1);
  } finally { sqlite.close(); }
});
