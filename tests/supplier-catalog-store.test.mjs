import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  acceptSupplierCatalogRun, beginSupplierCatalogRun, finishSupplierCatalogRun,
  readSupplierCatalog, readSupplierCatalogArchiveEntry, stageSupplierCatalogEntries,
} from "../app/lib/supplier-catalog-store.ts";

test('actual publish never serializes or reparses the already pinned full-detail generations',async()=>{
 const db=await database();let serialization=0;
 const summary={name:'Place',toJSON(){serialization++;return{name:'Place'};}};
 const detail={rooms:[{id:2}],body:'x'.repeat(100_000),toJSON(){serialization++;return{rooms:this.rooms,body:this.body};}};
 const entries=[{supplierId:1,summary,detail}];
 try{await beginSupplierCatalogRun(db,{id:'pinned-memory',world:'events',source:'test',startedAt:'2026-11-05T12:00:00Z',lockUntil:'2026-11-05T12:15:00Z'});await stageSupplierCatalogEntries(db,'pinned-memory','events',entries);assert.ok(serialization>0);serialization=0;
 await acceptSupplierCatalogRun(db,{id:'pinned-memory',world:'events',expectedCount:1,added:0,changed:0,removed:0,finishedAt:'2026-11-05T12:01:00Z',baseline:entries,previous:entries,candidate:entries});assert.equal(serialization,0);assert.equal((await readSupplierCatalog(db,'events')).entries[0].detail.body.length,100_000);
 }finally{db.close();}
});

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const name of ["0000_groovy_boomerang", "0001_brief_pixie", "0002_sour_tigra", "0003_catalog_diagnostics", "0013_adorable_moira_mactaggert"]) {
    const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
    for (const sql of source.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) sqlite.exec(sql);
  }
  function prepare(sql) {
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: result.changes } }; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
    };
  }
  return {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    close() { sqlite.close(); },
  };
}

function run(id, startedAt = "2026-10-12T12:00:00Z") {
  return { id, world: "spa", source: "spaplus-api", startedAt, lockUntil: "2026-10-12T12:15:00Z" };
}

test("new run reconciles only the exact expired lock owner", async () => {
  const db = await database();
  try {
    assert.equal(await beginSupplierCatalogRun(db, run("expired-old", "2026-10-12T11:00:00Z")), true);
    await db.prepare("UPDATE supplier_catalog_state SET lock_until = ? WHERE world = ?").bind("2026-10-12T11:15:00Z", "spa").run();
    assert.equal(await beginSupplierCatalogRun(db, run("new-owner", "2026-10-12T12:00:00Z")), true);
    assert.equal((await db.prepare("SELECT status FROM supplier_catalog_runs WHERE id = ?").bind("expired-old").first()).status, "failed");
    assert.equal((await db.prepare("SELECT lock_run_id AS id FROM supplier_catalog_state WHERE world = 'spa'").first()).id, "new-owner");
  } finally { db.close(); }
});

test("explicit supplier inactivity archives complete data and later reactivation preserves the canonical identity", async () => {
  const db = await database();
  const initial = Array.from({ length: 20 }, (_, index) => ({ supplierId: index + 1,
    summary: { name: `מקום ${index + 1}`, sourceUrl: `https://www.vii.co.il/place_${index + 1}` },
    detail: { description: `תיאור ${index + 1}`, rooms: [] } }));
  try {
    await beginSupplierCatalogRun(db, { id: "archive-base", world: "vacations", source: "test", startedAt: "2026-11-14T00:00:00Z", lockUntil: "2026-11-14T00:15:00Z" });
    await stageSupplierCatalogEntries(db, "archive-base", "vacations", initial);
    await acceptSupplierCatalogRun(db, { id: "archive-base", world: "vacations", expectedCount: 20, added: 20, changed: 0, removed: 0,
      finishedAt: "2026-11-14T00:01:00Z", baseline: [], previous: [], candidate: initial });

    const inactive = initial.slice(0, 19);
    await beginSupplierCatalogRun(db, { id: "archive-remove", world: "vacations", source: "test", startedAt: "2026-11-14T01:00:00Z", lockUntil: "2026-11-14T01:15:00Z" });
    await stageSupplierCatalogEntries(db, "archive-remove", "vacations", inactive);
    await acceptSupplierCatalogRun(db, { id: "archive-remove", world: "vacations", expectedCount: 19, added: 0, changed: 0, removed: 1,
      finishedAt: "2026-11-14T01:01:00Z", previous: initial, candidate: inactive,
      sourceInventory: { activeCount: 19, previousInactiveIds: [20], previousInactiveIdsTruncated: false, previousUnknownActivityIds: [], previousUnknownActivityIdsTruncated: false } });
    const archived = await readSupplierCatalogArchiveEntry(db, "vacations", 20);
    assert.equal(archived.status, "inactive");
    assert.equal(archived.canonicalPath, "/business?id=vacation-20");
    assert.deepEqual(archived.detail, initial[19].detail);

    await beginSupplierCatalogRun(db, { id: "archive-return", world: "vacations", source: "test", startedAt: "2026-11-14T02:00:00Z", lockUntil: "2026-11-14T02:15:00Z" });
    await stageSupplierCatalogEntries(db, "archive-return", "vacations", initial);
    await acceptSupplierCatalogRun(db, { id: "archive-return", world: "vacations", expectedCount: 20, added: 1, changed: 0, removed: 0,
      finishedAt: "2026-11-14T02:01:00Z", previous: inactive, candidate: initial,
      sourceInventory: { activeCount: 20, previousInactiveIds: [], previousInactiveIdsTruncated: false, previousUnknownActivityIds: [], previousUnknownActivityIdsTruncated: false } });
    const returned = await readSupplierCatalogArchiveEntry(db, "vacations", 20);
    assert.equal(returned.status, "active");
    assert.equal(returned.canonicalPath, archived.canonicalPath);
    assert.equal(returned.reactivatedAt, "2026-11-14T02:01:00Z");
  } finally { db.close(); }
});

test("unexpired owner is not reconciled and duplicate run remains side-effect free", async () => {
  const db = await database();
  try {
    assert.equal(await beginSupplierCatalogRun(db, run("active-owner")), true);
    assert.equal(await beginSupplierCatalogRun(db, run("active-owner")), false);
    assert.equal((await db.prepare("SELECT status FROM supplier_catalog_runs WHERE id = ?").bind("active-owner").first()).status, "running");
    assert.equal((await db.prepare("SELECT lock_run_id AS id FROM supplier_catalog_state WHERE world = 'spa'").first()).id, "active-owner");
  } finally { db.close(); }
});

test("fresh competitor is fenced and expired owner cannot stage, publish, or clear the new lock", async () => {
  const db = await database();
  try {
    await beginSupplierCatalogRun(db, run("accepted-base"));
    await stageSupplierCatalogEntries(db, "accepted-base", "spa", [{ supplierId: 1, summary: { title: "base" } }]);
    await acceptSupplierCatalogRun(db, { id: "accepted-base", world: "spa", expectedCount: 1, added: 1, changed: 0, removed: 0, finishedAt: "2026-10-12T12:03:00Z" });
    await beginSupplierCatalogRun(db, { ...run("expired-owner", "2026-10-12T13:00:00Z"), lockUntil: "2026-10-12T13:05:00Z" });
    await db.prepare("UPDATE supplier_catalog_state SET lock_until = ? WHERE world = ?").bind("2026-10-12T13:05:00Z", "spa").run();
    assert.equal(await beginSupplierCatalogRun(db, { ...run("fresh-competitor", "2026-10-12T13:06:00Z"), lockUntil: "2026-10-12T13:21:00Z" }), true);
    assert.equal(await beginSupplierCatalogRun(db, { ...run("another-fresh", "2026-10-12T13:07:00Z"), lockUntil: "2026-10-12T13:22:00Z" }), false);
    assert.equal((await db.prepare("SELECT active_run_id AS id, lock_run_id AS lockId FROM supplier_catalog_state WHERE world='spa'").first()).id, "accepted-base");
    await assert.rejects(() => stageSupplierCatalogEntries(db, "expired-owner", "spa", [{ supplierId: 2, summary: {} }]), /invalid_catalog_stage/);
    await finishSupplierCatalogRun(db, { id: "expired-owner", world: "spa", status: "failed", errorCode: "late", finishedAt: "2026-10-12T13:08:00Z" });
    assert.equal((await db.prepare("SELECT lock_run_id AS id FROM supplier_catalog_state WHERE world='spa'").first()).id, "fresh-competitor");
    await assert.rejects(() => acceptSupplierCatalogRun(db, { id: "expired-owner", world: "spa", expectedCount: 0, added: 0, changed: 0, removed: 0, finishedAt: "2026-10-12T13:09:00Z" }));
  } finally { db.close(); }
});

test("first generation compares allowed removals with the bundled baseline", async () => {
  const db = await database();
  try {
    const baseline = Array.from({ length: 40 }, (_, index) => ({ supplierId: index + 1, summary: { id: index + 1, packages: [] } }));
    await beginSupplierCatalogRun(db, run("baseline-first"));
    await stageSupplierCatalogEntries(db, "baseline-first", "spa", baseline.slice(0, 39));
    await acceptSupplierCatalogRun(db, {
      id: "baseline-first", world: "spa", expectedCount: 39, added: 0, changed: 0, removed: 1,
      finishedAt: "2026-10-12T12:03:00Z", baseline,
    });
    assert.equal((await readSupplierCatalog(db, "spa")).entries.length, 39);
    assert.equal((await db.prepare("SELECT before_count FROM supplier_catalog_runs WHERE id = ?").bind("baseline-first").first()).before_count, 40);
  } finally { db.close(); }
});

test("accepted generations are read in bounded keyset pages instead of one oversized D1 result", async () => {
  const db = await database();
  try {
    const entries = Array.from({ length: 19 }, (_, index) => ({
      supplierId: index + 1,
      summary: { id: index + 1 },
      detail: { body: `detail-${index + 1}` },
    }));
    await beginSupplierCatalogRun(db, run("paged-active"));
    await stageSupplierCatalogEntries(db, "paged-active", "spa", entries);
    await acceptSupplierCatalogRun(db, {
      id: "paged-active", world: "spa", expectedCount: entries.length,
      added: entries.length, changed: 0, removed: 0,
      finishedAt: "2026-10-12T12:03:00Z",
    });
    let detailPageReads = 0;
    const bounded = {
      ...db,
      prepare(sql) {
        if (/SELECT supplier_id AS supplierId, summary_json AS summaryJson,\s*detail_json AS detailJson/.test(sql)) {
          detailPageReads += 1;
          assert.match(sql, /supplier_id > \?/);
          assert.match(sql, /LIMIT \?/);
        }
        return db.prepare(sql);
      },
    };
    const catalog = await readSupplierCatalog(bounded, "spa");
    assert.equal(catalog.entries.length, entries.length);
    assert.equal(catalog.entries.at(-1).detail.body, "detail-19");
    assert.equal(detailPageReads, 3);
  } finally { db.close(); }
});

test("first generation still rejects excessive removals from the bundled baseline", async () => {
  const db = await database();
  try {
    const baseline = Array.from({ length: 40 }, (_, index) => ({ supplierId: index + 1, summary: { id: index + 1, packages: [] } }));
    await beginSupplierCatalogRun(db, run("baseline-reject"));
    await stageSupplierCatalogEntries(db, "baseline-reject", "spa", baseline.slice(0, 37));
    await assert.rejects(() => acceptSupplierCatalogRun(db, {
      id: "baseline-reject", world: "spa", expectedCount: 37, added: 0, changed: 0, removed: 3,
      finishedAt: "2026-10-12T12:03:00Z", baseline,
    }), /catalog_removal_requires_review/);
    assert.equal(await readSupplierCatalog(db, "spa"), null);
  } finally { db.close(); }
});

test("publishes a complete generation and keeps it active when a later candidate is rejected", async () => {
  const db = await database();
  try {
    assert.equal(await beginSupplierCatalogRun(db, run("first-run")), true);
    assert.equal(await beginSupplierCatalogRun(db, run("other-run")), false);
    await stageSupplierCatalogEntries(db, "first-run", "spa", [
      { supplierId: 1, summary: { title: "First" } },
      { supplierId: 2, summary: { title: "Second" } },
    ]);
    await assert.rejects(() => acceptSupplierCatalogRun(db, {
      id: "first-run", world: "spa", expectedCount: 3, added: 3, changed: 0, removed: 0,
      finishedAt: "2026-10-12T12:02:00Z",
    }), /catalog_candidate_not_accepted/);
    assert.equal(await readSupplierCatalog(db, "spa"), null);
    await acceptSupplierCatalogRun(db, {
      id: "first-run", world: "spa", expectedCount: 2, added: 2, changed: 0, removed: 0,
      finishedAt: "2026-10-12T12:03:00Z",
    });
    assert.equal((await readSupplierCatalog(db, "spa")).entries.length, 2);

    assert.equal(await beginSupplierCatalogRun(db, run("second-run")), true);
    await stageSupplierCatalogEntries(db, "second-run", "spa", [
      { supplierId: 1, summary: { title: "Updated" } },
    ]);
    await assert.rejects(() => acceptSupplierCatalogRun(db, {
      id: "second-run", world: "spa", expectedCount: 1, added: 0, changed: 1, removed: 0,
      finishedAt: "2026-10-12T12:04:00Z",
    }), /catalog_removal_requires_review/);
    assert.equal((await readSupplierCatalog(db, "spa")).entries[0].summary.title, "First");
    await finishSupplierCatalogRun(db, {
      id: "second-run", world: "spa", status: "rejected", errorCode: "catalog_removal_requires_review",
      finishedAt: "2026-10-12T12:04:00Z",
    });
    assert.equal(await beginSupplierCatalogRun(db, run("third-run")), true);
  } finally {
    db.close();
  }
});

test("rejects invalid staging before writing any candidate row", async () => {
  const db = await database();
  try {
    await beginSupplierCatalogRun(db, run("valid-run"));
    await assert.rejects(() => stageSupplierCatalogEntries(db, "valid-run", "spa", [
      { supplierId: 1, summary: { title: "A" } }, { supplierId: 1, summary: { title: "B" } },
    ]), /invalid_supplier_id/);
    await assert.rejects(() => stageSupplierCatalogEntries(db, "valid-run", "spa", [
      { supplierId: 1, summary: { body: "x".repeat(1_800_001) } },
    ]), /catalog_entry_too_large/);
    await assert.rejects(() => acceptSupplierCatalogRun(db, {
      id: "valid-run", world: "spa", expectedCount: 1, added: 1, changed: 0, removed: 0,
      finishedAt: "2026-10-12T12:05:00Z",
    }), /catalog_candidate_not_accepted/);
  } finally {
    db.close();
  }
});

test("does not publish an active spa after its package disappears", async () => {
  const db = await database();
  try {
    await beginSupplierCatalogRun(db, run("package-old"));
    await stageSupplierCatalogEntries(db, "package-old", "spa", [
      { supplierId: 8, summary: { id: 8, packages: [{ id: 41 }] } },
    ]);
    await acceptSupplierCatalogRun(db, {
      id: "package-old", world: "spa", expectedCount: 1, added: 1, changed: 0, removed: 0,
      finishedAt: "2026-10-12T12:01:00Z",
    });
    await beginSupplierCatalogRun(db, run("package-new"));
    await stageSupplierCatalogEntries(db, "package-new", "spa", [
      { supplierId: 8, summary: { id: 8, packages: [] } },
    ]);
    await assert.rejects(() => acceptSupplierCatalogRun(db, {
      id: "package-new", world: "spa", expectedCount: 1, added: 0, changed: 1, removed: 0,
      finishedAt: "2026-10-12T12:02:00Z",
    }), /catalog_removal_requires_review/);
    assert.equal((await readSupplierCatalog(db, "spa")).entries[0].summary.packages.length, 1);
  } finally {
    db.close();
  }
});
