import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { readCatalogBootstrap } from "../app/lib/public-catalog-read.ts";

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
  );`);
  const db = {
    batchCalls: 0,
    failOverlay: false,
    prepare(sql) {
      let values = [];
      const statement = {
        bind(...next) { values = next; return statement; },
        async first() { return sqlite.prepare(sql).get(...values) ?? null; },
        async all() {
          if (db.failOverlay && sql.includes("vii_content_items")) throw new Error("overlay_read_failed");
          return { results: sqlite.prepare(sql).all(...values) };
        },
      };
      return statement;
    },
    async batch(statements) {
      db.batchCalls += 1;
      return Promise.all(statements.map((statement) => statement.all()));
    },
  };
  return { sqlite, db };
}

function content(title) {
  return JSON.stringify({ title, summary: "תקציר עריכתי מלא", body: "תוכן", metaTitle: title,
    metaDescription: "תיאור", imageAlt: "תמונה", links: [], attributes: {} });
}

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
