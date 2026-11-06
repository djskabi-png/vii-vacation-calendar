import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./fixture.mjs";
import { createBrowserQualityJob, consumeBrowserQualityJob } from "../src/browser-job-platform.ts";
import { requestQualityJobCancel } from "../../../app/lib/quality-job-store.ts";
import {payloadHash} from '../../../app/lib/quality-job-store.ts';

const source = "a".repeat(40);
const build = "01234567-89ab-cdef-0123-456789abcdef";
const env = () => ({ BROWSER_ENABLED: "true", EXPECTED_SOURCE_VERSION: source, EXPECTED_BUILD_ID: build, PUBLIC_ORIGIN: "https://vii.spaplus.co", QUALITY_BROWSER: { fetch: async () => new Response("{}") } });
const executor = async ({ jobId,sourceSha, buildId, profileId }) => ({ jobId,status: "passed", sourceVersion: sourceSha, buildId, profileId, requestCount: 1, steps: 2, elapsedMs: 12 });

test("browser job uses the real D1-shaped store and completes one profile", async () => {
  const f = fixture();
  try {
    const queued = await createBrowserQualityJob(f.db, { actor: "browser-qa", idempotencyKey: "browser-job-1", sourceVersion: source, buildId: build, profileId: "vacations-mobile-world-shell", origin: env().PUBLIC_ORIGIN });
    const result = await consumeBrowserQualityJob(f.db, queued.job.runId, env(), executor, { clock: () => new Date("2026-11-06T12:00:00.000Z") });
    assert.equal(result.status, "passed");
    assert.equal(f.sqlite.prepare("SELECT status FROM quality_jobs WHERE run_id=?").get(queued.job.runId).status, "completed");
  } finally { f.sqlite.close(); }
});

test("invalid environment and profile fail closed before queue execution", async () => {
  const f = fixture();
  try {
    await assert.rejects(createBrowserQualityJob(f.db, { actor: "browser-qa", idempotencyKey: "browser-job-2", sourceVersion: "bad", buildId: build, profileId: "vacations-mobile-world-shell", origin: env().PUBLIC_ORIGIN }), /definition_invalid/);
    await assert.rejects(createBrowserQualityJob(f.db, { actor: "browser-qa", idempotencyKey: "browser-job-3", sourceVersion: source, buildId: build, profileId: "unknown-profile", origin: env().PUBLIC_ORIGIN }), /definition_invalid/);
  } finally { f.sqlite.close(); }
});

test("duplicate consume does not execute a completed job twice", async () => {
  const f = fixture(); let calls = 0;
  try { const q = await createBrowserQualityJob(f.db, { actor: "browser-qa", idempotencyKey: "browser-job-4", sourceVersion: source, buildId: build, profileId: "vacations-mobile-world-shell", origin: env().PUBLIC_ORIGIN });
    const run = async () => consumeBrowserQualityJob(f.db, q.job.runId, env(), async input => { calls++; return executor(input); });
    assert.equal((await run()).status, "passed"); assert.equal((await run()).status, "not_claimed"); assert.equal(calls, 1);
  } finally { f.sqlite.close(); }
});

test("global browser lane admits one concurrent execution", async () => {
  const f = fixture(); let release,enter; const barrier = new Promise(resolve => { release = resolve; });const entered=new Promise(resolve=>{enter=resolve;}); let calls = 0;
  try { const a = await createBrowserQualityJob(f.db, { actor: "browser-qa", idempotencyKey: "browser-job-5", sourceVersion: source, buildId: build, profileId: "vacations-mobile-world-shell", origin: env().PUBLIC_ORIGIN }); const b = await createBrowserQualityJob(f.db, { actor: "browser-qa", idempotencyKey: "browser-job-6", sourceVersion: source, buildId: build, profileId: "events-mobile-world-shell", origin: env().PUBLIC_ORIGIN });
    const execute = async input => { calls++;enter(); await barrier; return executor(input); }; const first = consumeBrowserQualityJob(f.db, a.job.runId, env(), execute); await entered; const second = await consumeBrowserQualityJob(f.db, b.job.runId, env(), execute); assert.equal(second.status, "not_claimed"); release(); assert.equal((await first).status, "passed"); assert.equal((await consumeBrowserQualityJob(f.db, b.job.runId, env(), execute)).status, "passed"); assert.equal(calls, 2);
  } finally { f.sqlite.close(); }
});

test("cancel while browser executor awaits produces no receipt", async () => {
  const f = fixture(); let release,enter; const barrier = new Promise(resolve => { release = resolve; });const entered=new Promise(resolve=>{enter=resolve;});
  try { const q = await createBrowserQualityJob(f.db, { actor: "browser-qa", idempotencyKey: "browser-job-7", sourceVersion: source, buildId: build, profileId: "vacations-mobile-world-shell", origin: env().PUBLIC_ORIGIN }); const running = consumeBrowserQualityJob(f.db, q.job.runId, env(), async input => {enter();await barrier;return executor(input); }); await entered; await requestQualityJobCancel(f.db, q.job.runId); release(); const result = await running; assert.equal(result.status, "cancelled"); assert.equal(f.sqlite.prepare("SELECT json_array_length(receipts_json) AS n FROM quality_jobs WHERE run_id=?").get(q.job.runId).n, 0);
  } finally { f.sqlite.close(); }
});

test("expired lease fences a late browser commit", async () => {
  const f = fixture(); let tick = 0;
  try { const q = await createBrowserQualityJob(f.db, { actor: "browser-qa", idempotencyKey: "browser-job-8", sourceVersion: source, buildId: build, profileId: "vacations-mobile-world-shell", origin: env().PUBLIC_ORIGIN }); const result = await consumeBrowserQualityJob(f.db, q.job.runId, env(), async input => { tick = 60_000; return executor(input); }, { clock: () => new Date(Date.parse("2026-11-06T12:00:00.000Z") + tick) }); assert.equal(result.status, "blocked"); assert.equal(f.sqlite.prepare("SELECT status FROM quality_jobs WHERE run_id=?").get(q.job.runId).status, "blocked");
  } finally { f.sqlite.close(); }
});

test("interrupted active check blocks resume without replay", async () => {
  const f = fixture(); let calls = 0;
  try { const q = await createBrowserQualityJob(f.db, { actor: "browser-qa", idempotencyKey: "browser-job-9", sourceVersion: source, buildId: build, profileId: "vacations-mobile-world-shell", origin: env().PUBLIC_ORIGIN }); f.sqlite.prepare("UPDATE quality_jobs SET status='running',active_index=0,lease_until=? WHERE run_id=?").run("2026-01-01T00:00:00.000Z", q.job.runId); const result = await consumeBrowserQualityJob(f.db, q.job.runId, env(), async input => { calls++; return executor(input); }); assert.equal(result.status, "blocked"); assert.equal(calls, 0);
  } finally { f.sqlite.close(); }
});

test('a changed build or a changed profile definition durably blocks before any browser starts',async()=>{
 const f=fixture();let calls=0;try{
  const input={actor:'browser-qa',idempotencyKey:'browser-definition-1',sourceVersion:source,buildId:build,profileId:'spa-mobile-world-shell',origin:env().PUBLIC_ORIGIN};
  const q=await createBrowserQualityJob(f.db,input);
  const result=await consumeBrowserQualityJob(f.db,q.job.runId,{...env(),EXPECTED_BUILD_ID:'11111111-2222-3333-4444-555555555555'},async value=>{calls++;return executor(value);});
  assert.equal(result.status,'blocked');assert.equal(f.sqlite.prepare('SELECT status FROM quality_jobs WHERE run_id=?').get(q.job.runId).status,'blocked');
  const second=await createBrowserQualityJob(f.db,{...input,idempotencyKey:'browser-definition-2'});
  const changed=structuredClone(second.job.checks[0]);changed.configuration.profile.maxRequests=999;
  f.sqlite.prepare('UPDATE quality_jobs SET checks_json=?,definition_version=? WHERE run_id=?').run(JSON.stringify([changed]),await payloadHash(changed),second.job.runId);
  assert.equal((await consumeBrowserQualityJob(f.db,second.job.runId,env(),async value=>{calls++;return executor(value);})).status,'blocked');assert.equal(calls,0);
 }finally{f.sqlite.close();}
});

test('a late consumer cannot revoke a newer execution lease or publish its own receipt',async()=>{
 const f=fixture();try{
  const q=await createBrowserQualityJob(f.db,{actor:'browser-qa',idempotencyKey:'browser-newer-owner',sourceVersion:source,buildId:build,profileId:'spa-mobile-world-shell',origin:env().PUBLIC_ORIGIN});
  const result=await consumeBrowserQualityJob(f.db,q.job.runId,env(),async value=>{
   f.sqlite.prepare("UPDATE quality_jobs SET lease_token='newer-owner',lease_until=? WHERE run_id=?").run(new Date(Date.now()+120000).toISOString(),q.job.runId);return executor(value);
  });
  assert.equal(result.status,'not_claimed');const saved=f.sqlite.prepare('SELECT status,lease_token AS owner,json_array_length(receipts_json) AS receipts FROM quality_jobs WHERE run_id=?').get(q.job.runId);
  assert.equal(saved.status,'running');assert.equal(saved.owner,'newer-owner');assert.equal(saved.receipts,0);
 }finally{f.sqlite.close();}
});
