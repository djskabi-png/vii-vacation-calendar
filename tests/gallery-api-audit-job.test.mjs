import test from "node:test";
import assert from "node:assert/strict";
import { fetchGalleryAuditSource, createGalleryAuditJob, readGalleryAuditJob, readGalleryAuditDiagnostics, stepGalleryAuditJob } from "../app/lib/gallery-api-audit-job.ts";

const jsonResponse = (value, init = {}) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" }, ...init });

test("gallery source rejects redirects before following", async () => {
  await assert.rejects(
    fetchGalleryAuditSource("https://bizonline.co.il/api/ai/vii/vacations/1", {}, async () => new Response(null, { status: 302, headers: { location: "https://evil.example" } })),
    /provider_redirect/,
  );
});

test("gallery source enforces streamed body limit", async () => {
  const oversized = new Uint8Array(16_000_001);
  await assert.rejects(
    fetchGalleryAuditSource("https://bizonline.co.il/api/ai/vii/vacations/1", {}, async () => new Response(oversized, { status: 200 })),
    /provider_body_too_large/,
  );
});

test("gallery source rejects empty and invalid JSON", async () => {
  await assert.rejects(fetchGalleryAuditSource("https://example.test", {}, async () => new Response(" ", { status: 200 })), /provider_empty/);
  await assert.rejects(fetchGalleryAuditSource("https://example.test", {}, async () => new Response("not-json", { status: 200 })), /gallery_invalid_json/);
});

test("gallery source returns bounded valid wire text", async () => {
  const wire = JSON.stringify({ places: [{ siteID: 1, active: true }] });
  assert.equal(await fetchGalleryAuditSource("https://example.test", {}, async () => jsonResponse({ places: [{ siteID: 1, active: true }] })), wire);
});

class FakeR2 {
  #objects = new Map();
  async head(key) { const x = this.#objects.get(key); return x ? { etag: x.etag } : null; }
  async get(key) { const x = this.#objects.get(key); return x ? { etag: x.etag, text: async () => x.value } : null; }
  async put(key, value, options = {}) {
    const prior = this.#objects.get(key);
    if (options.onlyIf?.etagDoesNotMatch === "*" && prior) return null;
    if (options.onlyIf?.etagMatches && (!prior || prior.etag !== options.onlyIf.etagMatches)) return null;
    const etag = `etag-${this.#objects.size}-${Math.random()}`;
    this.#objects.set(key, { value: String(value), etag });
    return { etag };
  }
  keys() { return [...this.#objects.keys()]; }
}
function fakeDb(worlds) {
  return { prepare(sql) {
    return { bind(...args) {
      return {
        async first() { const world = args[0]; return worlds[world] ? { activeRunId: `run-${world}`, activeCount: worlds[world].length } : null; },
        async all() { const world = args[1] ?? args[0]; return { results: (worlds[world] || []).map(supplierId => ({ supplierId })) }; },
      };
    } };
  } };
}

test("a failed context identifies its source and stores private metadata without retrying the terminal job", async () => {
  const bucket = new FakeR2(), db = fakeDb({ vacations: [1], events: [2], rooms: [3], spa: [4] });
  const jobId = "11111111-1111-4111-8111-111111111111";
  await createGalleryAuditJob({ db, bucket, jobId });
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response("not-json"); };
  const options = { db, bucket, jobId, env: { SERGEY_VII_API_TOKEN: "fixture", SPAPLUS_VII_API_KEY: "fixture" }, fetchImpl };
  const failed = await stepGalleryAuditJob(options);
  assert.equal(failed.state, "error");
  assert.deepEqual(failed.sourceIssues, ["provider_context:locations:gallery_invalid_json"]);
  const diagnostics = await readGalleryAuditDiagnostics(bucket, jobId);
  assert.equal(diagnostics.length, 9);
  assert.equal(diagnostics[0].state, "error");
  assert.equal(diagnostics[0].errorCode, "gallery_invalid_json");
  assert.equal(JSON.stringify(diagnostics).includes("not-json"), false);
  await stepGalleryAuditJob(options);
  assert.equal(calls, 1);
});

test("concurrent start with same UUID reserves one identical job", async () => {
  const bucket = new FakeR2();
  const db = fakeDb({ vacations: [1], events: [2], rooms: [3], spa: [4] });
  const [a, b] = await Promise.all([
    createGalleryAuditJob({ db, bucket, jobId: "11111111-1111-4111-8111-111111111111", now: () => 1000 }),
    createGalleryAuditJob({ db, bucket, jobId: "11111111-1111-4111-8111-111111111111", now: () => 1000 }),
  ]);
  assert.deepEqual(a, b);
  assert.equal(bucket.keys().filter(k => k.endsWith("job.json")).length, 1);
});

test("read summary excludes inventory, results and credentials", async () => {
  const bucket = new FakeR2();
  const db = fakeDb({ vacations: [1], events: [2], rooms: [3], spa: [4] });
  const id = "22222222-2222-4222-8222-222222222222";
  await createGalleryAuditJob({ db, bucket, jobId: id, now: () => 1000 });
  const summary = await readGalleryAuditJob(bucket, id);
  assert.equal(summary.total, 4);
  assert.equal("inventory" in summary, false);
  assert.equal("results" in summary, false);
  assert.equal("SERGEY_VII_API_TOKEN" in summary, false);
});

test("missing world inventory fails closed without reserving a job", async () => {
  const bucket = new FakeR2();
  await assert.rejects(createGalleryAuditJob({ db: fakeDb({ vacations: [1], events: [2], rooms: [3] }), bucket, jobId: "33333333-3333-4333-8333-333333333333" }), /missing_world_inventory:spa/);
  assert.equal(bucket.keys().length, 0);
});

test("deadline is terminal and performs no provider fetch", async () => {
  const bucket = new FakeR2();
  const db = fakeDb({ vacations: [1], events: [2], rooms: [3], spa: [4] });
  const id = "44444444-4444-4444-8444-444444444444";
  await createGalleryAuditJob({ db, bucket, jobId: id, now: () => 1000 });
  let calls = 0;
  const summary = await stepGalleryAuditJob({ db, bucket, jobId: id, env: { SERGEY_VII_API_TOKEN: "x", SPAPLUS_VII_API_KEY: "x" }, now: () => 3_601_001, fetchImpl: async () => { calls++; throw new Error("must_not_fetch"); } });
  assert.equal(summary.state, "deadline");
  assert.equal(calls, 0);
});

