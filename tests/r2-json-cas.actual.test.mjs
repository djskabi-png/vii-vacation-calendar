import assert from "node:assert/strict";
import test from "node:test";
import { MIN_INTERVAL_MS, putPacedR2Json } from "../app/lib/r2-json-cas.ts";

function rateBucket() {
  const objects = new Map();
  const calls = [];
  return { objects, calls, async put(key, value, options = {}) {
    const previous = objects.get(key);
    const now = this.now();
    calls.push({ key, value, options, now });
    if (previous && now - previous.uploaded < 1000) throw new Error("rate_limited");
    if (options.onlyIf?.etagMatches && (!previous || previous.etag !== options.onlyIf.etagMatches)) return null;
    const revision = { etag: `etag-${calls.length}`, uploaded: new Date(now), value };
    objects.set(key, revision);
    return revision;
  }, now: () => 0 };
}

test("old immediate triple-write pattern hits a same-key rate limit", async () => {
  const bucket = rateBucket();
  await putPacedR2Json(bucket, "job", "lease", {}, undefined, { now: () => 0 });
  await assert.rejects(() => bucket.put("job", "running", {}), /rate_limited/);
  assert.equal(bucket.objects.get("job").value, "lease");
});

test("paced native-style revisions survive and return uploaded metadata", async () => {
  const bucket = rateBucket(); let now = 0; bucket.now = () => now;
  const waits = [];
  const first = await putPacedR2Json(bucket, "job", "one", {}, undefined, { now: () => now });
  const second = await putPacedR2Json(bucket, "job", "two", {}, first, { now: () => now, wait: async (ms) => { waits.push(ms); now += ms; } });
  assert.equal(waits[0], MIN_INTERVAL_MS);
  assert.equal(second.value, "two");
  assert.ok(second.uploaded instanceof Date);
  const third = await putPacedR2Json(bucket, "job", "three", {onlyIf:{etagMatches:second.etag}}, second, {now:()=>now,wait:async ms=>{waits.push(ms);now+=ms;}});
  assert.equal(third.value,'three');assert.deepEqual(waits,[MIN_INTERVAL_MS,MIN_INTERVAL_MS]);
});

test("CAS loser is returned unchanged and is not retried", async () => {
  const bucket = rateBucket(); let now = 0; bucket.now = () => now;
  const first = await bucket.put("job", "one", {});
  now += MIN_INTERVAL_MS;
  const result = await putPacedR2Json(bucket, "job", "stale", { onlyIf: { etagMatches: "wrong" } }, first, { now: () => now });
  assert.equal(result, null);
  assert.equal(bucket.calls.length, 2);
  assert.equal(bucket.objects.get("job").value, "one");
});

test("failed writes are not retried", async () => {
  const bucket = { calls: 0, async put() { this.calls++; throw new Error("write_failed"); } };
  await assert.rejects(() => putPacedR2Json(bucket, "job", "x", {}), /write_failed/);
  assert.equal(bucket.calls, 1);
});

test("malformed and far-future metadata refuse without an unbounded wait", async () => {
  const bucket = { async put() { throw new Error("must not write"); } };
  await assert.rejects(() => putPacedR2Json(bucket, "job", "x", {}, { uploaded: "not-a-date" }, { now: () => 0 }), /r2_revision_timestamp_invalid/);
  await assert.rejects(() => putPacedR2Json(bucket, "job", "x", {}, { uploaded: new Date(120_000) }, { now: () => 0 }), /r2_revision_time_future/);
});
