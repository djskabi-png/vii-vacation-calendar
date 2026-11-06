import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';
import { admitScheduledChecks,scheduledCheckSelection,schedulerWindowOpen } from '../src/scheduler.ts';
import { qualityRegistry } from '../../../app/lib/quality-platform.ts';
import { ensureQualityJobSchema, enqueueQualityJob } from '../../../app/lib/quality-job-store.ts';
const options=(now,create)=>({now,generation:'test-generation',enabled:true,createScheduledJob:create});

test('disabled makes no schemas or jobs; invalid generation fails before admission',async()=>{
 const f=fixture();try{assert.deepEqual(await admitScheduledChecks(f.db,{...options(600000,async()=>{throw Error('must not create')}),enabled:false}),[]);assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get().n,0);await assert.rejects(admitScheduledChecks(f.db,options(NaN,async()=>'')),/invalid_scheduler_generation/);}finally{f.sqlite.close();}
});
test('concurrent cron invocations share a durable global limit of two admissions per minute',async()=>{
 const f=fixture();const created=[];try{const create=async a=>{created.push(a);return `job-${created.length}`};const out=await Promise.all([admitScheduledChecks(f.db,options(600000,create)),admitScheduledChecks(f.db,options(600000,create))]);assert.equal(created.length,2);assert.equal(new Set(created.map(x=>x.checkId)).size,2);assert.equal(out.flat().length,2);assert.deepEqual(await admitScheduledChecks(f.db,options(600000,create)),[]);assert.equal(created.length,2);}finally{f.sqlite.close();}
});
test('unknown creation suppresses that check across later cadence buckets and generations',async()=>{
 const f=fixture();let failed;try{const failedAdmission=await admitScheduledChecks(f.db,{...options(600000,async a=>{failed=a.checkId;throw Error('ambiguous create')}),maxAdmissions:1});assert.equal(failedAdmission[0].status,'unknown');const out=await admitScheduledChecks(f.db,{...options(36000000,async a=>`job-${a.checkId}`),generation:'new-generation'});assert.ok(out.length>0);assert.ok(out.every(a=>a.checkId!==failed));assert.equal(f.sqlite.prepare('SELECT status FROM quality_scheduler_admissions WHERE check_id=?').get(failed).status,'unknown');}finally{f.sqlite.close();}
});
test('actual active job checks suppress admission without caller-supplied active state',async()=>{
 const f=fixture();try{await ensureQualityJobSchema(f.db);const checks=qualityRegistry.map(c=>({checkId:c.checkId,definitionVersion:'test',configuration:{}}));await enqueueQualityJob(f.db,{actor:'admin',idempotencyKey:'existing-active-job',payload:null,sourceVersion:'v1',definitionVersion:'test',checks});const out=await admitScheduledChecks(f.db,options(600000,async()=>{throw Error('must not create')}));assert.deepEqual(out,[]);}finally{f.sqlite.close();}
});
test('persisted cadence overrides use elapsed time rather than incompatible bucket numbers',async()=>{
 const f=fixture();try{const first=await admitScheduledChecks(f.db,{...options(600000,async a=>`first-${a.checkId}`),maxAdmissions:1});const id=first[0].checkId;f.sqlite.prepare('INSERT INTO quality_schedule_overrides VALUES(?,?,?,?)').run(id,5,'now','admin');const active=qualityRegistry.filter(c=>c.checkId!==id).map(c=>({checkId:c.checkId,status:'running'}));const before=await admitScheduledChecks(f.db,{...options(600000+299999,async()=>{throw Error('too early')}),existing:active});assert.deepEqual(before,[]);const after=await admitScheduledChecks(f.db,{...options(600000+300000,async a=>`later-${a.checkId}`),existing:active});assert.equal(after.length,1);assert.equal(after[0].checkId,id);}finally{f.sqlite.close();}
});

test('one failed admission cannot abort another due check in the same tick',async()=>{const f=fixture();let calls=0;try{const out=await admitScheduledChecks(f.db,options(600000,async a=>{calls++;if(calls===1)throw Error('one creation failed');return `job-${a.checkId}`}));assert.equal(out.length,2);assert.deepEqual(out.map(x=>x.status),['unknown','linked']);assert.equal(calls,2);}finally{f.sqlite.close();}});

test('explicit canary selection cannot silently broaden to unrelated registry checks',async()=>{
 const f=fixture();try{const ids=scheduledCheckSelection('["global.home.semantic"]');assert.ok(Object.isFrozen(ids));const created=[];const first=await admitScheduledChecks(f.db,{...options(600000,async a=>{created.push(a.checkId);return 'canary-run-id'}),checkIds:ids});assert.equal(first.length,1);assert.deepEqual(created,['global.home.semantic']);assert.deepEqual(await admitScheduledChecks(f.db,{...options(660000,async()=>{throw Error('cadence not due')}),checkIds:ids}),[]);}finally{f.sqlite.close();}
 for(const raw of ['["unknown.check"]','["global.home.semantic","global.home.semantic"]','{}','not-json'])assert.throws(()=>scheduledCheckSelection(raw),/invalid_scheduler_selection/);
 const empty=fixture();try{assert.deepEqual(await admitScheduledChecks(empty.db,{...options(600000,async()=>{throw Error('not allowed')}),checkIds:[]}),[]);assert.equal(empty.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get().n,0);}finally{empty.sqlite.close();}
});

test('optional canary window is finite and cannot silently become a permanent schedule',()=>{
 const now=Date.now();assert.equal(schedulerWindowOpen(undefined,now),true);assert.equal(schedulerWindowOpen(new Date(now+120000).toISOString(),now),true);assert.equal(schedulerWindowOpen(new Date(now).toISOString(),now),false);assert.throws(()=>schedulerWindowOpen('not-a-date',now),/invalid_scheduler_window/);assert.throws(()=>schedulerWindowOpen(new Date(now+3600000).toISOString(),now),/invalid_scheduler_window/);
});
