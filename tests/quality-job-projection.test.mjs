import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { ensureQualitySchema, persistQualityJobProgress, flushQueuedQualityNotifications } from "../app/lib/quality-platform.ts";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  let failOnce = null;
  const db = { prepare(sql) { let args = []; const statement = {
    sql,
    bind(...values) { args = values; return statement; },
    async run() { if (failOnce && failOnce(sql)) { failOnce = null; throw new Error("injected_projection_crash"); } const result = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; },
    async first() { return sqlite.prepare(sql).get(...args) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
  }; return statement; }, async batch(statements) { for (const statement of statements) sqlite.prepare(statement.sql).run(...(statement._args || [])); } };
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => { const statement = prepare(sql); const bind = statement.bind; statement.bind = (...values) => { statement._args = values; return bind(...values); }; return statement; };
  return { sqlite, db, failOnce: predicate => { failOnce = predicate; } };
}
const now = "2026-11-06T10:00:00.000Z";
const sourceCheck = { checkId: "projection-check", family: "projection", world: "vacations", route: "/", viewport: "desktop", severity: "high", status: "failed", expected: 200 };
function job(overrides = {}) {
  const check = { checkId: sourceCheck.checkId, definitionVersion: "http-contract-v1", configuration: { check: sourceCheck, origin: "https://example.test" } };
  return { runId: "job-projection-1234", actor: "admin@example.com", sourceVersion: "build-1", definitionVersion: "definition-1", checks: [check], expectedCheckIds: [check.checkId], receipts: [{ checkId: check.checkId, status: "failed", observed: "500", checkedAt: now }], nextIndex: 1, activeIndex: null, status: "completed", leaseToken: null, leaseUntil: null, cancelRequestedAt: null, reason: null, createdAt: now, updatedAt: now, ...overrides };
}

test("job projection creates the legacy run, result and incident exactly once", async () => {
  const f = fixture();
  try {
    await ensureQualitySchema(f.db);
    const first = await persistQualityJobProgress(f.db, job(), { EMAIL_API_KEY: "" }, async () => new Response());
    const second = await persistQualityJobProgress(f.db, job(), { EMAIL_API_KEY: "" }, async () => new Response());
    assert.equal(first, true, `first projection returned ${first}`); assert.equal(second, false, "terminal projection is idempotent and does not reopen the run");
    assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM quality_runs").first()).n, 1);
    assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM quality_results").first()).n, 1);
    assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM quality_incidents").first()).n, 1);
    const run = await f.db.prepare("SELECT status,failed_count AS failed,blocked_count AS blocked FROM quality_runs WHERE id=?").bind("job-projection-1234").first();
    assert.equal(run.status, "failed"); assert.equal(run.failed, 1); assert.equal(run.blocked, 0);
  } finally { f.sqlite.close(); }
});

test("incomplete or cancelled jobs never project green", async () => {
  for (const overrides of [{ status: "completed", receipts: [], nextIndex: 0 }, { status: "cancelled", receipts: [], nextIndex: 0 }, { status: "blocked", receipts: [], nextIndex: 0 }]) {
    const f = fixture();
    try {
      await ensureQualitySchema(f.db); await persistQualityJobProgress(f.db, job(overrides), {}, async () => new Response());
      const run = await f.db.prepare("SELECT status FROM quality_runs WHERE id=?").bind("job-projection-1234").first();
      assert.notEqual(run.status, "passed");
    } finally { f.sqlite.close(); }
  }
});

test("projection never reopens a terminal run or lets an older receipt close a newer failure", async () => {
  const f = fixture();
  try {
    await ensureQualitySchema(f.db); await persistQualityJobProgress(f.db, job(), {}, async () => new Response());
    const older = job({ runId: "older-distinct-run", updatedAt: "2026-11-06T09:00:00.000Z", status: "completed", receipts: [{ checkId: sourceCheck.checkId, status: "passed", observed: "200", checkedAt: "2026-11-06T09:00:00.000Z" }] });
    const applied = await persistQualityJobProgress(f.db, older, {}, async () => new Response());
    assert.equal(applied, true);
    assert.equal((await f.db.prepare("SELECT status FROM quality_runs WHERE id=?").bind("job-projection-1234").first()).status, "failed");
    assert.equal((await f.db.prepare("SELECT status FROM quality_incidents WHERE check_id=?").bind(sourceCheck.checkId).first()).status, "open");
  } finally { f.sqlite.close(); }
});

test("projection outbox defers provider I/O, concurrent consumers send once, and network uncertainty is never retried", async () => {
 const env={VII_QUALITY_EMAIL_PROVIDER:'resend',VII_QUALITY_EMAIL_API_KEY:'fixture-only',VII_QUALITY_EMAIL_FROM:'qa@example.test',VII_QUALITY_EMAIL_RECIPIENTS:'owner@example.test'};
 for(const uncertain of [false,true]){
  const f=fixture();let calls=0;const provider=async()=>{calls++;if(uncertain)throw Error('synthetic_network_uncertainty');return Response.json({id:'fixture-provider-id'});};
  try{
   await persistQualityJobProgress(f.db,job(),env,provider);assert.equal(calls,0);assert.equal(f.sqlite.prepare('SELECT status FROM quality_notification_outbox').get().status,'queued');
   await Promise.all([flushQueuedQualityNotifications(f.db,env,provider),flushQueuedQualityNotifications(f.db,env,provider)]);assert.equal(calls,1);
   await flushQueuedQualityNotifications(f.db,env,provider);assert.equal(calls,1);
   assert.equal(f.sqlite.prepare('SELECT status FROM quality_notification_deliveries').get().status,uncertain?'unknown':'sent');
  }finally{f.sqlite.close();}
 }
});

test("crash after incident and before projection receipt cannot duplicate occurrence or outbox event",async()=>{
 const f=fixture();try{
  f.failOnce(sql=>sql.includes('INSERT OR IGNORE INTO quality_job_projection_receipts'));
  await assert.rejects(persistQualityJobProgress(f.db,job()),/injected_projection_crash/);
  await persistQualityJobProgress(f.db,job());assert.equal(f.sqlite.prepare('SELECT occurrences FROM quality_incidents').get().occurrences,1);assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM quality_notification_outbox').get().n,1);
 }finally{f.sqlite.close();}
});

test("outbox skips an obsolete opening and expired processing stays uncertain without another send",async()=>{
 const f=fixture();const env={VII_QUALITY_EMAIL_PROVIDER:'resend',VII_QUALITY_EMAIL_API_KEY:'fixture-only',VII_QUALITY_EMAIL_FROM:'qa@example.test',VII_QUALITY_EMAIL_RECIPIENTS:'owner@example.test'};let calls=0;
 try{
  await persistQualityJobProgress(f.db,job());f.sqlite.prepare("UPDATE quality_incidents SET status='resolved'").run();
  await flushQueuedQualityNotifications(f.db,env,async()=>{calls++;return Response.json({id:'never'});});assert.equal(calls,0);assert.equal(f.sqlite.prepare('SELECT status FROM quality_notification_outbox').get().status,'superseded');
  f.sqlite.prepare("UPDATE quality_notification_outbox SET status='processing',updated_at='2000-01-01T00:00:00.000Z'").run();
  await flushQueuedQualityNotifications(f.db,env,async()=>{calls++;return Response.json({id:'never'});});assert.equal(calls,0);assert.equal(f.sqlite.prepare('SELECT status FROM quality_notification_outbox').get().status,'unknown');
 }finally{f.sqlite.close();}
});

test("provider idempotency separates a recurrence from the original incident cycle",async()=>{
 const f=fixture();const keys=[];const env={VII_QUALITY_EMAIL_PROVIDER:'resend',VII_QUALITY_EMAIL_API_KEY:'fixture-only',VII_QUALITY_EMAIL_FROM:'qa@example.test',VII_QUALITY_EMAIL_RECIPIENTS:'owner@example.test'};
 const provider=async(_url,init)=>{keys.push(init.headers['Idempotency-Key']);return Response.json({id:`fixture-${keys.length}`});};
 try{
  await persistQualityJobProgress(f.db,job());await flushQueuedQualityNotifications(f.db,env,provider);
  const recovery=job({runId:'recovery-run',updatedAt:'2026-11-06T10:01:00.000Z',receipts:[{checkId:sourceCheck.checkId,status:'passed',observed:'200',checkedAt:'2026-11-06T10:01:00.000Z'}]});
  await persistQualityJobProgress(f.db,recovery);await flushQueuedQualityNotifications(f.db,env,provider);
  const recurrence=job({runId:'recurrence-run',updatedAt:'2026-11-06T10:02:00.000Z',receipts:[{checkId:sourceCheck.checkId,status:'failed',observed:'500',checkedAt:'2026-11-06T10:02:00.000Z'}]});
  await persistQualityJobProgress(f.db,recurrence);await flushQueuedQualityNotifications(f.db,env,provider);
  assert.equal(keys.length,3);assert.equal(new Set(keys).size,3);assert.ok(keys[2].endsWith(':opened:2'));
 }finally{f.sqlite.close();}
});

test("a crash after result insertion before incident projection is recoverable and idempotent", async () => {
  const f = fixture();
  try {
    await ensureQualitySchema(f.db);
    f.failOnce(sql => sql.includes("INSERT INTO quality_incidents"));
    await assert.rejects(persistQualityJobProgress(f.db, job(), {}, async () => new Response()), /injected_projection_crash/);
    assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM quality_results").first()).n, 1);
    assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM quality_incidents").first()).n, 0);
    assert.equal(await persistQualityJobProgress(f.db, job(), {}, async () => new Response()), true);
    assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM quality_results").first()).n, 1);
    assert.equal((await f.db.prepare("SELECT COUNT(*) AS n FROM quality_incidents").first()).n, 1);
  } finally { f.sqlite.close(); }
});
