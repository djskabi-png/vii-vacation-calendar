import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import {executeQualityCheck,selectManualQualityChecks,persistQualityJobProgress,readQualityScopeOptions} from '../app/lib/quality-platform.ts';
import {enqueueQualityJob,readQualityJob,readQualityJobByIntent,payloadHash,dueQualityJobIds} from '../app/lib/quality-job-store.ts';
import {runQualityJobSlice} from '../app/lib/quality-job-runner.ts';
import {qualityScopeMetadata} from '../app/lib/quality-check-scope.ts';

function load(path,deps,names){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  const code=stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm,''),{mode:'strip'}).replace(/^export /gm,'');
  return new Function(...Object.keys(deps),`${code};return {${names.join(',')}};`)(...Object.values(deps));
}
function fixture(){
  const sqlite=new DatabaseSync(':memory:');
  const db={prepare(sql){let args=[];const statement={bind(...values){args=values;return statement;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}},async first(){return sqlite.prepare(sql).get(...args)??null},async all(){return{results:sqlite.prepare(sql).all(...args)}}};return statement;},async batch(statements){const result=[];for(const statement of statements)result.push(await statement.run());return result;}};
  const platform=load('../app/lib/quality-job-platform.ts',{executeQualityCheck,selectManualQualityChecks,persistQualityJobProgress,enqueueQualityJob,readQualityJob,payloadHash,dueQualityJobIds,runQualityJobSlice,qualityScopeMetadata,__VII_CACHE_BUILD_ID__:'fixture-build'},['createManualQualityJob']);
  const pending=[];
  const route=load('../app/api/admin/quality/route.ts',{authorizedAdminSession:async()=>({email:'fixture@example.test'}),requiredRuntimeDatabase:async()=>db,readQualityScopeOptions,readQualityJobByIntent,createManualQualityJob:platform.createManualQualityJob,getRequestExecutionContext:()=>({waitUntil:promise=>pending.push(promise)}),consumeQualityJob:async()=>null},['GET','POST']);
  return{sqlite,db,route,pending};
}
const request=body=>new Request('https://fixture.example.test/api/admin/quality',{method:'POST',headers:{origin:'https://fixture.example.test','content-type':'application/json'},body:JSON.stringify(body)});

test('actual scoped API parser persists a real durable job without undefined optional payload fields',async()=>{
  const f=fixture();try{
    const body={action:'enqueue',idempotencyKey:'scoped-key-12345678',level:'full',scope:{changedBoxes:['maps']}};
    const first=await f.route.POST(request(body));assert.equal(first.status,202,JSON.stringify(await first.clone().json()));
    const job=(await first.json()).job;const stored=await readQualityJob(f.db,job.runId);
    const expected=selectManualQualityChecks('full',{changedBoxes:['maps']}).map(check=>check.checkId);
    assert.deepEqual(stored.expectedCheckIds,expected);assert.equal(stored.status,'queued');assert.equal(f.pending.length,1);
    const retry=await f.route.POST(request(body));assert.equal(retry.status,202);assert.equal((await retry.json()).job.runId,job.runId);
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM quality_jobs').get().n,1);
    const reconciled=await f.route.GET(new Request('https://fixture.example.test/api/admin/quality?intentKey=scoped-key-12345678'));
    assert.equal(reconciled.status,200);assert.equal((await reconciled.json()).job.runId,job.runId);
    assert.equal(await readQualityJobByIntent(f.db,'another-actor@example.test',body.idempotencyKey),null);
  }finally{f.sqlite.close();}
});
test('actual invalid level/unknown scope produces no partially admitted job',async()=>{
  const f=fixture();try{
    for(const [key,level,scope] of [['low-level-key-1234','regular',{changedBoxes:['maps']}],['unknown-key-1234','full',{changedBoxes:['unknown']}],['optional-key-1234','full',{changedBoxes:['maps'],unknownOwner:false}]]){
      const response=await f.route.POST(request({action:'enqueue',idempotencyKey:key,level,scope}));
      assert.equal(response.status,key==='optional-key-1234'?202:400);
    }
    assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM quality_jobs').get().n,1);
  }finally{f.sqlite.close();}
});
