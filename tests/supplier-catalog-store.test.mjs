import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  acceptSupplierCatalogRun, beginSupplierCatalogRun, finishSupplierCatalogRun,
  readSupplierCatalog, stageSupplierCatalogEntries,
} from "../app/lib/supplier-catalog-store.ts";

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const name of ["0000_groovy_boomerang", "0001_brief_pixie", "0002_sour_tigra"]) {
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
