import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { claimQualityJob, enqueueQualityJob, readQualityJob, requestQualityJobCancel, startQualityJobCheck, commitQualityJobCheck, finishQualityJobSlice } from "../app/lib/quality-job-store.ts";
import { runQualityJobSlice } from "../app/lib/quality-job-runner.ts";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  const db = { prepare(sql) { let args = []; const statement = {
    bind(...values) { args = values; return statement; },
    async run() { const result = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; },
    async first() { return sqlite.prepare(sql).get(...args) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
  }; return statement; } };
  return { sqlite, db };
}
const check = (checkId, configuration = {}) => ({ checkId, definitionVersion: "q1", configuration });
const base = { actor: "admin@example.com", idempotencyKey: "quality-1234", payload: { scope: "all" }, sourceVersion: "build-1", definitionVersion: "q1", checks: [check("a"), check("b")] };
const close = ({ sqlite }) => sqlite.close();

test("enqueue is atomic, idempotent, actor-scoped and immutable", async () => {
  const f = fixture();
  try {
    const first = await enqueueQualityJob(f.db, base);
    const [sameA, sameB] = await Promise.all([enqueueQualityJob(f.db, base), enqueueQualityJob(f.db, base)]);
    assert.equal(first.job.runId, sameA.job.runId); assert.equal(first.job.runId, sameB.job.runId);
    for (const change of [{ payload: { scope: "changed" } }, { sourceVersion: "build-2" }, { definitionVersion: "q2" }, { checks: [check("a", { changed: true }), check("b")] }]) {
      await assert.rejects(enqueueQualityJob(f.db, { ...base, ...change }), /quality_job_idempotency_conflict/);
    }
    const otherActor = await enqueueQualityJob(f.db, { ...base, actor: "other@example.com" });
    const rerun = await enqueueQualityJob(f.db, { ...base, idempotencyKey: "quality-5678" });
    assert.notEqual(otherActor.job.runId, first.job.runId); assert.notEqual(rerun.job.runId, first.job.runId);
    assert.deepEqual(rerun.job.expectedCheckIds, ["a", "b"]);
  } finally { close(f); }
});

test("source mismatch is persisted blocked and cannot execute", async () => {
  const f = fixture();
  try { const job = (await enqueueQualityJob(f.db, base)).job; let calls = 0;
    const result = await runQualityJobSlice(f.db, { runId: job.runId, leaseToken: "lease-1", sourceVersion: "build-2", definitionVersion: "q1", execute: async () => { calls++; return { status: "passed", observed: "ok" }; } });
    assert.equal(result.status, "blocked"); assert.equal(calls, 0); assert.equal((await readQualityJob(f.db, job.runId)).reason, "source_or_definition_changed");
  } finally { close(f); }
});

test("simultaneous first enqueue converges and crash before receipt blocks rather than replaying", async () => {
 const f=fixture();try{
  const [a,b]=await Promise.all([enqueueQualityJob(f.db,base),enqueueQualityJob(f.db,base)]);assert.equal(a.job.runId,b.job.runId);assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM quality_jobs').get().n,1);
  const now='2026-11-06T00:00:00.000Z';
  await claimQualityJob(f.db,a.job.runId,{leaseToken:'crashed',now,leaseUntil:'2026-11-06T00:00:01.000Z'});
  assert.equal(await startQualityJobCheck(f.db,{runId:a.job.runId,leaseToken:'crashed',index:0,now}),true);
  let executed=0;const result=await runQualityJobSlice(f.db,{runId:a.job.runId,leaseToken:'resumed',sourceVersion:'build-1',definitionVersion:'q1',clock:()=>Date.parse('2026-11-06T00:00:02.000Z'),execute:async()=>{executed++;return{status:'passed',observed:'must not replay'};}});
  assert.equal(result.status,'blocked');assert.equal(executed,0);assert.equal((await readQualityJob(f.db,a.job.runId)).reason,'interrupted_check_uncommitted');
 }finally{close(f);}
});

test("expired or superseded lease cannot commit cursor, receipt or late completion",async()=>{
 const f=fixture();try{
  const job=(await enqueueQualityJob(f.db,base)).job;const now='2026-11-06T00:00:00.000Z';
  await claimQualityJob(f.db,job.runId,{leaseToken:'old',now,leaseUntil:'2026-11-06T00:00:01.000Z'});await startQualityJobCheck(f.db,{runId:job.runId,leaseToken:'old',index:0,now});
  const commit={runId:job.runId,leaseToken:'old',index:0,receipt:{checkId:'a',status:'passed',observed:'late',checkedAt:now},now:'2026-11-06T00:00:02.000Z'};
  assert.equal(await commitQualityJobCheck(f.db,commit),false);
  assert.equal(await claimQualityJob(f.db,job.runId,{leaseToken:'new',now:commit.now,leaseUntil:'2026-11-06T00:00:10.000Z'}),true);
  assert.equal(await commitQualityJobCheck(f.db,{...commit,now}),false);assert.equal(await finishQualityJobSlice(f.db,{runId:job.runId,leaseToken:'old',status:'completed',now}),false);
  const saved=await readQualityJob(f.db,job.runId);assert.equal(saved.nextIndex,0);assert.equal(saved.receipts.length,0);
 }finally{close(f);}
});

test("receipt and cursor are atomic and committed checks are not replayed", async () => {
  const f = fixture();
  try { const job = (await enqueueQualityJob(f.db, base)).job; const seen = [];
    const first = await runQualityJobSlice(f.db, { runId: job.runId, leaseToken: "lease-1", sourceVersion: "build-1", definitionVersion: "q1", budgetMs: 10_000, execute: async c => { seen.push(c.checkId); return { status: "passed", observed: "ok" }; } });
    assert.equal(first.status, "completed"); assert.deepEqual(seen, ["a", "b"]); assert.equal((await readQualityJob(f.db, job.runId)).receipts.length, 2);
    const rerun = await runQualityJobSlice(f.db, { runId: job.runId, leaseToken: "lease-2", sourceVersion: "build-1", definitionVersion: "q1", execute: async c => { seen.push(c.checkId); return { status: "passed", observed: "replay" }; } });
    assert.equal(rerun.status, "not_claimed"); assert.deepEqual(seen, ["a", "b"]);
  } finally { close(f); }
});

test("running cancellation cannot commit a result and expired lease cannot start", async () => {
  const f = fixture();
  try { const job = (await enqueueQualityJob(f.db, base)).job; let release;
    const pending = new Promise(resolve => { release = resolve; });
    const running = runQualityJobSlice(f.db, { runId: job.runId, leaseToken: "lease-1", sourceVersion: "build-1", definitionVersion: "q1", checkTimeoutMs: 1_000, execute: async (_c, signal) => { await pending; return { status: signal.aborted ? "blocked" : "passed", observed: "ok" }; } });
    await new Promise(resolve => setTimeout(resolve, 15)); await requestQualityJobCancel(f.db, job.runId); release();
    assert.equal((await running).status, "cancelled"); assert.equal((await readQualityJob(f.db, job.runId)).receipts.length, 0);
    const other = (await enqueueQualityJob(f.db, { ...base, idempotencyKey: "quality-9999" })).job;
    assert.equal(await claimQualityJob(f.db, other.runId, { leaseToken: "lease-expired", leaseUntil: "2020-01-01T00:00:01.000Z", now: "2020-01-01T00:00:02.000Z" }), false);
    assert.equal((await readQualityJob(f.db, other.runId)).status, "queued");
  } finally { close(f); }
});

test("thrown and uncooperative checks become blocked within the configured deadline", async () => {
  for (const mode of ["throw", "hang"]) { const f = fixture();
    try { const job = (await enqueueQualityJob(f.db, { ...base, idempotencyKey: `quality-${mode}` })).job; const started = Date.now();
      const result = await runQualityJobSlice(f.db, { runId: job.runId, leaseToken: "lease-1", sourceVersion: "build-1", definitionVersion: "q1", budgetMs: 50, checkTimeoutMs: 15,
        execute: async () => { if (mode === "throw") throw new Error("provider_failed"); await new Promise(() => {}); return { status: "passed", observed: "never" }; } });
      assert.equal(result.status, "blocked"); assert.ok(Date.now() - started < 500); assert.equal((await readQualityJob(f.db, job.runId)).reason, mode === "hang" ? "check_timeout" : "check_execution_unverified");
    } finally { close(f); }
  }
});

test("shared slice budget yields and resumes same run without replay", async () => {
  const f = fixture();
  try { const job = (await enqueueQualityJob(f.db, base)).job; let now = 1_000; const seen = []; const clock = () => now;
    const first = await runQualityJobSlice(f.db, { runId: job.runId, leaseToken: "lease-1", sourceVersion: "build-1", definitionVersion: "q1", budgetMs: 20, clock, execute: async c => { seen.push(c.checkId); now += 25; return { status: "passed", observed: "ok" }; } });
    assert.equal(first.status, "yielded"); assert.deepEqual(seen, ["a"]); assert.equal((await readQualityJob(f.db, job.runId)).nextIndex, 1);
    now += 100; const second = await runQualityJobSlice(f.db, { runId: job.runId, leaseToken: "lease-2", sourceVersion: "build-1", definitionVersion: "q1", budgetMs: 20, clock, execute: async c => { seen.push(c.checkId); return { status: "passed", observed: "ok" }; } });
    assert.equal(second.status, "completed"); assert.deepEqual(seen, ["a", "b"]); assert.equal((await readQualityJob(f.db, job.runId)).receipts.length, 2);
  } finally { close(f); }
});
