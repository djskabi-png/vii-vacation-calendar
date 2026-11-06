import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';
import { createController } from '../src/controller.ts';
import { browserProfiles } from '../src/browser-profiles.ts';
import { registerReleaseSubject, releaseDefinitionSetSha256, enqueueReleaseCheck, readReleaseSubjectEvidence, releaseJobContext } from '../src/release-subject.ts';
import { payloadHash, claimQualityJob, startQualityJobCheck, commitQualityJobCheck, finishQualityJobSlice, readQualityJob } from '../../../app/lib/quality-job-store.ts';

const build='01234567-89ab-cdef-0123-456789abcdef';
const request=(query='')=>new Request('https://vii.spaplus.co/api/admin/quality'+query,{method:query?'GET':'POST'});
async function setup() {
  const f=fixture();
  Object.assign(f.env,{RELEASE_AUTHORITY_ENABLED:'true',EXPECTED_SOURCE_VERSION:'a'.repeat(40),EXPECTED_APP_SOURCE_VERSION:'b'.repeat(40),EXPECTED_BROWSER_SOURCE_VERSION:'c'.repeat(40),EXPECTED_BUILD_ID:build,PUBLIC_ORIGIN:'https://vii.spaplus.co',BROWSER_ENABLED:'true',QUALITY_BROWSER:{fetch:async()=>new Response('{}')}});
  const descriptor={schemaVersion:1,candidateSource:'d'.repeat(40),candidateTree:'e'.repeat(40),applicationSource:f.env.EXPECTED_APP_SOURCE_VERSION,controllerSource:f.env.EXPECTED_SOURCE_VERSION,browserSource:f.env.EXPECTED_BROWSER_SOURCE_VERSION,buildId:build,artifactSetSha256:'1'.repeat(64),environmentSetSha256:'2'.repeat(64),definitionSetSha256:await releaseDefinitionSetSha256(f.env),issuedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+3_600_000).toISOString()};
  return {...f,descriptor};
}
async function complete(db,job,status='passed') {
  const now=new Date().toISOString(),leaseToken=crypto.randomUUID();
  assert.equal(await claimQualityJob(db,job.runId,{leaseToken,leaseUntil:new Date(Date.now()+3_600_000).toISOString(),now}),true);
  for(let index=0;index<job.checks.length;index++) {
    const checkedAt=new Date().toISOString();
    assert.equal(await startQualityJobCheck(db,{runId:job.runId,leaseToken,index,now:checkedAt}),true);
    assert.equal(await commitQualityJobCheck(db,{runId:job.runId,leaseToken,index,now:checkedAt,receipt:{checkId:job.checks[index].checkId,status,observed:'controlled fixture result',checkedAt}}),true);
  }
  assert.equal(await finishQualityJobSlice(db,{runId:job.runId,leaseToken,status:'completed',now:new Date().toISOString()}),true);
}

test('registration is immutable context, runtime sources and definitions are server validated, no runtime pin or publication claim',async()=>{
  const f=await setup();try {
    const saved=await registerReleaseSubject(f.env,f.descriptor,'owner@example.test');
    assert.equal(saved.subjectId,await payloadHash(f.descriptor));assert.equal(saved.publicationApproved,false);
    assert.deepEqual(await registerReleaseSubject(f.env,{...f.descriptor},'other@example.test'),saved);
    assert.throws(()=>f.sqlite.prepare("UPDATE quality_release_subjects SET descriptor_json='{}'").run(),/release_subject_immutable/);
    for(const patch of [{applicationSource:'f'.repeat(40)},{controllerSource:'f'.repeat(40)},{browserSource:'f'.repeat(40)},{buildId:'11111111-1111-1111-1111-111111111111'},{definitionSetSha256:'f'.repeat(64)}]) {
      await assert.rejects(registerReleaseSubject(f.env,{...f.descriptor,...patch},'owner@example.test'),/release_context_mismatch/);
    }
    // Different artifact/environment claims may be registered as different
    // contexts. Neither is evidence about actual artifacts or provider config.
    const other=await registerReleaseSubject(f.env,{...f.descriptor,artifactSetSha256:'f'.repeat(64)},'owner@example.test');
    assert.notEqual(other.subjectId,saved.subjectId);
    assert.equal((await readReleaseSubjectEvidence(f.env,other.subjectId)).runtimeEvidenceStatus,'incomplete');
  }finally{f.sqlite.close();}
});

test('disabled, invalid, stale, expired, unregistered and unknown admissions fail before creating a job',async()=>{
  const f=await setup();try {
    await assert.rejects(registerReleaseSubject({...f.env,RELEASE_AUTHORITY_ENABLED:'false'},f.descriptor,'owner'),/not_activated/);
    for(const patch of [{receipts:[]},{requiredChecks:[]},{issuedAt:'nonsense'},{expiresAt:new Date(Date.now()+2*86_400_000).toISOString()}]) {
      await assert.rejects(registerReleaseSubject(f.env,{...f.descriptor,...patch},'owner'),/descriptor_invalid/);
    }
    await assert.rejects(registerReleaseSubject(f.env,{...f.descriptor,issuedAt:new Date(Date.now()-600_000).toISOString()},'owner'),/registration_stale/);
    await assert.rejects(enqueueReleaseCheck(f.env,'0'.repeat(64),'http-full'),/not_registered/);
    const {subjectId}=await registerReleaseSubject(f.env,f.descriptor,'owner');
    await assert.rejects(enqueueReleaseCheck(f.env,subjectId,'only-one-cheap-check'),/check_unknown/);
    await assert.rejects(enqueueReleaseCheck(f.env,subjectId,'http-full',Date.parse(f.descriptor.expiresAt)),/subject_expired/);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='quality_jobs'").get().n,0);
  }finally{f.sqlite.close();}
});

test('authenticated controller reserves release namespace, enqueues one deterministic job and reconstructs durable evidence',async()=>{
  const f=await setup();try {
    const reg=await f.controller.handle(request(),f.env,'owner@example.test',{action:'release-register',descriptor:f.descriptor});
    assert.equal(reg.status,201);const {subjectId}=await reg.json();
    for(const action of ['enqueue','enqueue-browser']) {
      const denied=await f.controller.handle(request(),f.env,'owner@example.test',{action,level:'full',idempotencyKey:`release:${subjectId}:fake`,profileId:browserProfiles[0].profileId});
      assert.equal(denied.status,400);
    }
    assert.equal((await f.controller.handle(request(),f.env,'owner@example.test',{action:'release-enqueue',subjectId,checkKey:'http-full',receipts:[{status:'passed'}]})).status,400);
    const body={action:'release-enqueue',subjectId,checkKey:'http-full'};
    const a=await f.controller.handle(request(),f.env,'owner@example.test',body);assert.equal(a.status,202);const first=await a.json();
    const b=await f.controller.handle(request(),f.env,'another@example.test',body);assert.equal(b.status,202);const second=await b.json();
    assert.equal(first.job.runId,second.job.runId);assert.equal(second.duplicate,true);assert.equal(f.messages.length,1);assert.equal(f.executions(),0);
    const job=await readQualityJob(f.db,first.job.runId);
    assert.equal(job.actor,`release:${subjectId}`);assert.equal(job.idempotencyKey.startsWith(`release:${subjectId}:`),true);
    assert.equal(job.sourceVersion,build);assert.ok(job.checks.length>1);
    await complete(f.db,job);
    const rebuilt=createController({create:async()=>{throw Error('GET must not create');},consume:async()=>{throw Error('GET must not execute');}});
    const evidence=await rebuilt.handle(request(`?releaseSubjectId=${subjectId}`),f.env,'owner@example.test');
    assert.equal(evidence.status,200);const view=await evidence.json();
    assert.equal(view.runtimeEvidenceStatus,'incomplete');assert.equal(view.passedJobs,1);assert.equal(view.requiredJobs,browserProfiles.length+1);
    assert.equal(view.publicationApproved,false);assert.equal(view.publicReleaseVerified,false);
    assert.equal((await rebuilt.handle(request(`?releaseSubjectId=${subjectId}&scope=metadata`),f.env,'owner@example.test')).status,400);
  }finally{f.sqlite.close();}
});

test('every server-required HTTP/browser job must pass original snapshots and receipts; partial, failed, duplicate and stale evidence cannot green',async()=>{
  const f=await setup();try {
    const {subjectId}=await registerReleaseSubject(f.env,f.descriptor,'owner');
    const keys=['http-full',...browserProfiles.map(p=>`browser:${p.profileId}`)];
    assert.equal((await readReleaseSubjectEvidence(f.env,subjectId)).passedJobs,0);
    let last;
    for(const key of keys) {const {job}=await enqueueReleaseCheck(f.env,subjectId,key);await complete(f.db,job);last=job;}
    const passed=await readReleaseSubjectEvidence(f.env,subjectId);
    assert.equal(passed.runtimeEvidenceStatus,'passed');assert.equal(passed.passedJobs,35);assert.equal(passed.publicationApproved,false);
    const saved=f.sqlite.prepare('SELECT receipts_json AS receipts,checks_json AS checks,updated_at AS updated FROM quality_jobs WHERE run_id=?').get(last.runId);
    for(const mutation of [
      ()=>f.sqlite.prepare("UPDATE quality_jobs SET receipts_json='[]' WHERE run_id=?").run(last.runId),
      ()=>f.sqlite.prepare('UPDATE quality_jobs SET receipts_json=? WHERE run_id=?').run(JSON.stringify([...JSON.parse(saved.receipts),...JSON.parse(saved.receipts)]),last.runId),
      ()=>f.sqlite.prepare('UPDATE quality_jobs SET receipts_json=? WHERE run_id=?').run(JSON.stringify(JSON.parse(saved.receipts).map(r=>({...r,status:'failed'}))),last.runId),
      ()=>f.sqlite.prepare('UPDATE quality_jobs SET checks_json=? WHERE run_id=?').run(JSON.stringify(JSON.parse(saved.checks).map(c=>({...c,configuration:{...c.configuration,buildId:'11111111-1111-1111-1111-111111111111'}}))),last.runId),
      ()=>f.sqlite.prepare("UPDATE quality_jobs SET updated_at='2000-01-01T00:00:00.000Z' WHERE run_id=?").run(last.runId),
      ()=>f.sqlite.prepare("UPDATE quality_jobs SET status='cancelled' WHERE run_id=?").run(last.runId),
    ]) {
      mutation();assert.equal((await readReleaseSubjectEvidence(f.env,subjectId)).runtimeEvidenceStatus,'blocked');
      f.sqlite.prepare("UPDATE quality_jobs SET receipts_json=?,checks_json=?,updated_at=?,status='completed' WHERE run_id=?").run(saved.receipts,saved.checks,saved.updated,last.runId);
    }
    assert.equal((await readReleaseSubjectEvidence(f.env,subjectId)).runtimeEvidenceStatus,'passed');
    await assert.rejects(readReleaseSubjectEvidence({...f.env,EXPECTED_APP_SOURCE_VERSION:'f'.repeat(40)},subjectId),/context_mismatch/);
    await assert.rejects(readReleaseSubjectEvidence(f.env,subjectId,Date.parse(f.descriptor.expiresAt)),/subject_expired/);
  }finally{f.sqlite.close();}
});

test('an ambiguous release dispatch stays bound to its original blocked job and is never retried as a replacement',async()=>{
  const f=await setup();let sends=0;try {
    const {subjectId}=await registerReleaseSubject(f.env,f.descriptor,'owner');
    f.env.RELEASE_QUEUE.send=async()=>{sends++;throw Error('uncertain acknowledgement');};
    const body={action:'release-enqueue',subjectId,checkKey:`browser:${browserProfiles[0].profileId}`};
    const a=await (await f.controller.handle(request(),f.env,'owner',body)).json();
    assert.equal(a.job.status,'blocked');
    await f.controller.recover(f.env);
    const b=await (await f.controller.handle(request(),f.env,'owner',body)).json();
    assert.equal(a.job.runId,b.job.runId);assert.equal(b.duplicate,true);assert.equal(sends,1);
    assert.equal((await readReleaseSubjectEvidence(f.env,subjectId)).runtimeEvidenceStatus,'blocked');
  }finally{f.sqlite.close();}
});

test('queued release work is re-fenced at dispatch/recovery and consumption after disable, expiration or runtime change',async()=>{
  for(const patch of [{RELEASE_AUTHORITY_ENABLED:'false'},{EXPECTED_APP_SOURCE_VERSION:'f'.repeat(40)},{EXPECTED_BROWSER_SOURCE_VERSION:'f'.repeat(40)}]) {
    const f=await setup();try {
      const {subjectId}=await registerReleaseSubject(f.env,f.descriptor,'owner');
      const {job}=await enqueueReleaseCheck(f.env,subjectId,'http-full');
      assert.equal((await releaseJobContext(f.env,job)).allowed,true);
      assert.equal((await releaseJobContext(f.env,job,Date.parse(f.descriptor.expiresAt)-69_999)).reason,'release_window_closing');
      assert.equal((await releaseJobContext(f.env,job,Date.parse(f.descriptor.expiresAt)-70_000)).allowed,true);
      assert.equal((await releaseJobContext(f.env,job,Date.parse(f.descriptor.expiresAt))).allowed,false);
      Object.assign(f.env,patch);
      await f.controller.dispatch(f.env,job);
      assert.equal(f.messages.length,0);assert.equal((await readQualityJob(f.db,job.runId)).status,'blocked');
      assert.equal((await f.controller.consume(f.env,{version:1,runId:job.runId,expectedIndex:0,sourceVersion:job.sourceVersion,priority:'release'})).status,'obsolete');
      assert.equal(f.executions(),0);
    }finally{f.sqlite.close();}
  }
  const f=await setup();try {
    const {subjectId}=await registerReleaseSubject(f.env,f.descriptor,'owner');
    const response=await f.controller.handle(request(),f.env,'owner',{action:'release-enqueue',subjectId,checkKey:'http-full'});
    assert.equal(response.status,202);assert.equal(f.messages.length,1);
    f.env.RELEASE_AUTHORITY_ENABLED='false';
    assert.equal((await f.controller.consume(f.env,f.messages[0])).status,'blocked');assert.equal(f.executions(),0);
  }finally{f.sqlite.close();}
});

test('an altered descriptor stored under another subject ID cannot supply evidence for that subject',async()=>{
  const f=await setup();try {
    const {subjectId,registeredAt}=await registerReleaseSubject(f.env,f.descriptor,'owner');
    const different='f'.repeat(64);
    f.sqlite.prepare('INSERT INTO quality_release_subjects(subject_id,descriptor_json,registered_at,registered_by) VALUES(?,?,?,?)').run(different,JSON.stringify(f.descriptor),registeredAt,'fixture-tamper');
    await assert.rejects(readReleaseSubjectEvidence(f.env,different),/subject_corrupt/);
    assert.equal((await readReleaseSubjectEvidence(f.env,subjectId)).runtimeEvidenceStatus,'incomplete');
  }finally{f.sqlite.close();}
});
