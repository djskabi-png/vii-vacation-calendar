import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

test("catalog migrations add versioned generations without changing review indexes", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const name of ["0000_groovy_boomerang", "0001_brief_pixie", "0002_sour_tigra", "0003_catalog_diagnostics"]) {
      const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
      for (const statement of source.split("--> statement-breakpoint").map((sql) => sql.trim()).filter(Boolean)) {
        db.exec(statement);
      }
    }
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'supplier_catalog_%' ORDER BY name").all();
    assert.deepEqual(tables.map((row) => row.name), [
      "supplier_catalog_entries", "supplier_catalog_runs", "supplier_catalog_state",
    ]);
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'guest_review_files_object_key_unique'").get());
    db.exec("PRAGMA foreign_keys = ON");
    db.prepare("INSERT INTO supplier_catalog_runs (id, world, source, status, started_at) VALUES (?, ?, ?, ?, ?)")
      .run("run-1", "spa", "spaplus-api", "accepted", "2026-10-12T00:00:00Z");
    db.prepare("INSERT INTO supplier_catalog_entries (id, run_id, world, supplier_id, summary_json) VALUES (?, ?, ?, ?, ?)")
      .run("run-1:spa:1", "run-1", "spa", 1, "{}");
    db.prepare("INSERT INTO supplier_catalog_state (world, active_run_id, accepted_at, active_count) VALUES (?, ?, ?, ?)")
      .run("spa", "run-1", "2026-10-12T00:00:00Z", 1);
    assert.equal(db.prepare("SELECT active_count FROM supplier_catalog_state WHERE world = ?").get("spa").active_count, 1);
    const column = db.prepare("PRAGMA table_info(supplier_catalog_runs)").all().find((row) => row.name === "diagnostics_json");
    assert.equal(column.notnull, 0);
    assert.equal(column.dflt_value, null);
    assert.equal(db.prepare("SELECT diagnostics_json FROM supplier_catalog_runs WHERE id = 'run-1'").get().diagnostics_json, null);
  } finally {
    db.close();
  }
});
