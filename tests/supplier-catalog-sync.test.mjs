import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { runSupplierCatalogSync, compareSupplierCatalogEntries } from "../app/lib/supplier-catalog-sync.ts";
import { readSupplierCatalog } from "../app/lib/supplier-catalog-store.ts";

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const name of ["0000_groovy_boomerang", "0001_brief_pixie", "0002_sour_tigra"]) {
    const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
    for (const sql of source.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) sqlite.exec(sql);
  }
  const prepare = (sql) => {
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; },
    };
  };
  return {
    prepare,
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
    close() { sqlite.close(); },
  };
}

const at = () => new Date("2026-10-12T12:00:00Z");
const baseline = [
  { supplierId: 1, summary: { id: 1, packages: [{ id: 10 }] } },
  { supplierId: 2, summary: { id: 2, packages: [{ id: 20 }] } },
];

test("compares nested supplier inventory before publication", () => {
  const diff = compareSupplierCatalogEntries("spa", baseline, [
    { supplierId: 1, summary: { id: 1, packages: [] } },
    { supplierId: 3, summary: { id: 3, packages: [{ id: 30 }] } },
  ]);
  assert.deepEqual(diff.removed, [2]);
  assert.deepEqual(diff.removedChildren, [{ supplierId: 1, childId: 10 }]);
  assert.equal(diff.added, 1);
});

test("one guarded runner serves manual and scheduled triggers without replacing a good generation on rejection", async () => {
  const db = await database();
  try {
    const accepted = await runSupplierCatalogSync(db, {
      id: "catalog-run-1", world: "spa", source: "spaplus-api", baseline, now: at,
      fetchCandidate: async () => ({ fetchedAt: at().toISOString(), entries: baseline }),
    });
    assert.equal(accepted.status, "accepted");
    assert.equal((await readSupplierCatalog(db, "spa")).entries.length, 2);

    const rejected = await runSupplierCatalogSync(db, {
      id: "catalog-run-2", world: "spa", source: "spaplus-api", baseline, now: at,
      fetchCandidate: async () => ({ fetchedAt: at().toISOString(), entries: [baseline[0]] }),
    });
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.errorCode, "catalog_removal_requires_review");
    assert.equal((await readSupplierCatalog(db, "spa")).entries.length, 2);
  } finally {
    db.close();
  }
});

test("a small withdrawal is published, while a catalog collapse stays blocked", async () => {
  const db = await database();
  const many = Array.from({ length: 100 }, (_, index) => ({
    supplierId: index + 1, summary: { id: index + 1, packages: [{ id: index + 1001 }] },
  }));
  try {
    const initial = await runSupplierCatalogSync(db, {
      id: "catalog-many-1", world: "spa", source: "test", baseline: many, now: at,
      fetchCandidate: async () => ({ fetchedAt: at().toISOString(), entries: many }),
    });
    assert.equal(initial.status, "accepted");
    const withdrawn = await runSupplierCatalogSync(db, {
      id: "catalog-many-2", world: "spa", source: "test", baseline: many, now: at,
      fetchCandidate: async () => ({ fetchedAt: at().toISOString(), entries: many.slice(1) }),
    });
    assert.equal(withdrawn.status, "accepted");
    assert.equal(withdrawn.diff.removed.length, 1);
    assert.equal((await readSupplierCatalog(db, "spa")).entries.length, 99);
    const collapse = await runSupplierCatalogSync(db, {
      id: "catalog-many-3", world: "spa", source: "test", baseline: many, now: at,
      fetchCandidate: async () => ({ fetchedAt: at().toISOString(), entries: many.slice(50) }),
    });
    assert.equal(collapse.status, "rejected");
    assert.equal((await readSupplierCatalog(db, "spa")).entries.length, 99);
  } finally {
    db.close();
  }
});
