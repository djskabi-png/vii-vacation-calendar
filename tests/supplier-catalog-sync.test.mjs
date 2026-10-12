import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { runSupplierCatalogSync, compareSupplierCatalogEntries } from "../app/lib/supplier-catalog-sync.ts";
import { readSupplierCatalog, readSupplierCatalogDashboard } from "../app/lib/supplier-catalog-store.ts";
import { SupplierCatalogRedirectError } from "../app/lib/supplier-catalog-diagnostics.ts";
import { catalogResponse } from "../app/api/catalog/route.ts";
import { createSpaPlusCatalogClient } from "../app/lib/spaplus-catalog-client.ts";

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const name of ["0000_groovy_boomerang", "0001_brief_pixie", "0002_sour_tigra", "0003_catalog_diagnostics"]) {
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

test("rejection diagnostics persist counts and IDs privately without changing the accepted generation", async () => {
  const db = await database();
  try {
    await runSupplierCatalogSync(db, { id: "private-first", world: "spa", source: "test", baseline, now: at,
      fetchCandidate: async () => ({ fetchedAt: at().toISOString(), entries: baseline }) });
    const before = await readSupplierCatalog(db, "spa");
    const rejected = await runSupplierCatalogSync(db, { id: "private-reject", world: "spa", source: "test", baseline, now: at,
      fetchCandidate: async () => ({ fetchedAt: at().toISOString(), entries: [
        { supplierId: 1, summary: { id: 1, packages: [], contact: "must-not-be-stored-in-diagnostics" } },
        { supplierId: 3, summary: { id: 3, packages: [{ id: 30 }], key: "must-not-be-stored-in-diagnostics" } },
      ] }) });
    assert.equal(rejected.status, "rejected");
    assert.deepEqual(await readSupplierCatalog(db, "spa"), before);
    const dashboard = await readSupplierCatalogDashboard(db);
    const run = dashboard.runs.find((item) => item.id === "private-reject");
    assert.equal(run.beforeCount, 2);
    assert.equal(run.candidateCount, 2);
    assert.deepEqual(run.diagnostics.addedIds, [3]);
    assert.deepEqual(run.diagnostics.removedIds, [2]);
    assert.equal(run.diagnostics.units.removedTotal, 2);
    assert.equal(run.diagnostics.units.removedWithPlaces, 1);
    assert.equal(run.diagnostics.units.removedFromRetainedPlaces, 1);
    assert.doesNotMatch(JSON.stringify(run), /must-not-be-stored|contact|"key"|diagnosticsJson/);
    const publicDB = { prepare(sql) {
      assert.doesNotMatch(sql, /supplier_catalog_runs|diagnostics_json/);
      return db.prepare(sql);
    } };
    const response = await catalogResponse(new Request("https://vii.spaplus.co/api/catalog?world=spa"), publicDB);
    const payload = await response.json();
    assert.deepEqual(payload.entries.map((item) => item.supplierId), [1, 2]);
    assert.doesNotMatch(JSON.stringify(payload), /diagnostics|must-not-be-stored|private-reject/);
  } finally { db.close(); }
});

test("a rejected first generation keeps the public bundled fallback", async () => {
  const db = await database();
  try {
    const result = await runSupplierCatalogSync(db, { id: "initial-reject", world: "spa", source: "test", baseline, now: at,
      fetchCandidate: async () => ({ fetchedAt: at().toISOString(), entries: [baseline[0]] }) });
    assert.equal(result.status, "rejected");
    assert.equal(result.diagnostics.before, 2);
    assert.equal(result.diagnostics.candidate, 1);
    assert.equal(await readSupplierCatalog(db, "spa"), null);
    const payload = await (await catalogResponse(new Request("https://vii.spaplus.co/api/catalog?world=spa"), db)).json();
    assert.equal(payload.source, "bundled-fallback");
    assert.equal(payload.entries.length, 159);
    assert.doesNotMatch(JSON.stringify(payload), /diagnostics|initial-reject/);
  } finally { db.close(); }
});

test("redirect diagnostics store only status and hostname, never credentials or URL components", async () => {
  const db = await database();
  try {
    const result = await runSupplierCatalogSync(db, { id: "redirect-private", world: "spa", source: "test", baseline, now: at,
      fetchCandidate: async () => { throw new SupplierCatalogRedirectError("spa_redirect_not_allowed", 302,
        "https://private-user:private-password@abuse.spd.co.il/private-path?key=private-key#private-fragment",
        "https://www.spaplus.co.il/vii/?key=private-base-key"); } });
    assert.equal(result.status, "failed");
    assert.deepEqual(result.diagnostics, { redirect: { status: 302, hostname: "abuse.spd.co.il" } });
    const run = (await readSupplierCatalogDashboard(db)).runs.find((item) => item.id === "redirect-private");
    assert.deepEqual(run.diagnostics, result.diagnostics);
    assert.doesNotMatch(JSON.stringify(run.diagnostics), /private|https|\?|#/);
    assert.equal(await readSupplierCatalog(db, "spa"), null);
  } finally { db.close(); }
});

test("spa parse failures persist private metadata without staging or changing the active generation", async () => {
  const db = await database();
  try {
    await runSupplierCatalogSync(db, { id: "json-good", world: "spa", source: "test", baseline, now: at,
      fetchCandidate: async () => ({ fetchedAt: at().toISOString(), entries: baseline }) });
    const before = await readSupplierCatalog(db, "spa");
    const client = createSpaPlusCatalogClient({ apiKey: "private-test-key", fetchImpl: async () =>
      new Response(" <html>private-body private-contact</html>", { headers: { "Content-Type": "text/html" } }) });
    const result = await runSupplierCatalogSync(db, { id: "json-failed", world: "spa", source: "test", baseline, now: at,
      fetchCandidate: () => client.fetchCandidate() });
    assert.equal(result.status, "failed");
    assert.equal(result.errorCode, "invalid_spa_response");
    assert.deepEqual(await readSupplierCatalog(db, "spa"), before);
    const run = (await readSupplierCatalogDashboard(db)).runs.find((item) => item.id === "json-failed");
    assert.deepEqual(run.diagnostics, result.diagnostics);
    assert.equal(run.diagnostics.spaJsonFailure.firstCharacterKind, "html-like");
    const stored = await db.prepare("SELECT diagnostics_json FROM supplier_catalog_runs WHERE id = ?").bind("json-failed").first();
    assert.doesNotMatch(stored.diagnostics_json, /private|contact|body|prefix|Location/);
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM supplier_catalog_entries WHERE run_id = ?").bind("json-failed").first()).n, 0);
    const publicDB = { prepare(sql) { assert.doesNotMatch(sql, /supplier_catalog_runs|diagnostics_json/); return db.prepare(sql); } };
    const response = await catalogResponse(new Request("https://vii.spaplus.co/api/catalog?world=spa"), publicDB);
    const publicPayload = await response.json();
    assert.deepEqual(publicPayload.entries.map((entry) => entry.supplierId), [1, 2]);
    assert.doesNotMatch(JSON.stringify(publicPayload), /spaJsonFailure|diagnostics|private|json-failed/);
  } finally { db.close(); }
});

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

test("spa media loss cannot replace an accepted catalog", async () => {
  const db = await database();
  const pictured = Array.from({ length: 20 }, (_, index) => ({
    supplierId: index + 1,
    summary: { id: index + 1, image: `https://www.spaplus.co.il/gallery/site-${index}.jpg`,
      gallery: [`https://www.spaplus.co.il/gallery/extra-${index}.jpg`],
      packages: [{ id: index + 1001, image: `https://www.spaplus.co.il/gallery/pack-${index}.jpg` }] },
  }));
  try {
    const accepted = await runSupplierCatalogSync(db, { id: "media-initial", world: "spa", source: "test",
      baseline: pictured, now: at, fetchCandidate: async () => ({ fetchedAt: at().toISOString(), entries: pictured }) });
    assert.equal(accepted.status, "accepted");
    for (const [id, entries] of [
      ["media-sites-lost", pictured.map((entry) => ({ ...entry, summary: { ...entry.summary, image: null } }))],
      ["media-packages-lost", pictured.map((entry) => ({ ...entry, summary: { ...entry.summary,
        packages: entry.summary.packages.map((pack) => ({ ...pack, image: null })) } }))],
      ["media-galleries-lost", pictured.map((entry) => ({ ...entry, summary: { ...entry.summary, gallery: [] } }))],
    ]) {
      const result = await runSupplierCatalogSync(db, { id, world: "spa", source: "test",
        baseline: pictured, now: at, fetchCandidate: async () => ({ fetchedAt: at().toISOString(), entries }) });
      assert.equal(result.status, "rejected");
      assert.equal(result.errorCode, "catalog_media_requires_review");
      assert.equal((await readSupplierCatalog(db, "spa")).entries.filter((entry) => entry.summary.image).length, 20);
    }
  } finally { db.close(); }
});
