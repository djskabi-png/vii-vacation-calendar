import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createGalleryAuditJob, readGalleryAuditJob } from "../app/lib/gallery-api-audit-job.ts";

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const name of ["0000_groovy_boomerang", "0001_brief_pixie", "0002_sour_tigra", "0003_catalog_diagnostics"]) {
    const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
    for (const sql of source.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) sqlite.exec(sql);
  }
  const prepare = (sql) => { let values = []; return { bind(...args) { values = args; return this; }, async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; };
  return { prepare, close: () => sqlite.close() };
}

class R2 {
  constructor() { this.objects = new Map(); }
  async head(key) { const value = this.objects.get(key); return value ? { etag: value.etag } : null; }
  async put(key, value, options = {}) { if (options.onlyIf?.etagDoesNotMatch === "*" && this.objects.has(key)) return null; const result = { etag: `etag-${this.objects.size}` }; this.objects.set(key, { value: String(value), etag: result.etag }); return result; }
  async get(key) { const value = this.objects.get(key); return value ? { etag: value.etag, text: async () => value.value } : null; }
}

test("real SQLite catalog inventory supports a four-world gallery audit reservation", async () => {
  const db = await database();
  try {
    const worlds = ["vacations", "events", "rooms", "spa"];
    for (const [index, world] of worlds.entries()) {
      await db.prepare("INSERT INTO supplier_catalog_runs (id, world, source, status, candidate_count, started_at, finished_at) VALUES (?, ?, 'fixture', 'accepted', 1, '2026-11-09T00:00:00Z', '2026-11-09T00:00:01Z')").bind(`run-${world}`, world).run();
      await db.prepare("INSERT INTO supplier_catalog_state (world, active_run_id, accepted_at, active_count) VALUES (?, ?, '2026-11-09T00:00:01Z', 1)").bind(world, `run-${world}`).run();
      await db.prepare("INSERT INTO supplier_catalog_entries (id, run_id, world, supplier_id, summary_json, detail_json) VALUES (?, ?, ?, ?, ?, ?)").bind(`entry-${world}`, `run-${world}`, world, index + 1, JSON.stringify({ name: world }), JSON.stringify({ images: [`/gallery/${world}.jpg`] })).run();
    }
    const bucket = new R2();
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const created = await createGalleryAuditJob({ db, bucket, jobId: id, now: () => 1_000 });
    assert.equal(created.total, 4);
    assert.equal((await readGalleryAuditJob(bucket, id)).total, 4);
  } finally { db.close(); }
});
