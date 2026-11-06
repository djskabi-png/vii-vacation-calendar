import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {fixture} from '../services/vii-quality-control/test/fixture.mjs';
import {registerReleaseSubject,releaseDefinitionSetSha256,enqueueReleaseCheck} from '../services/vii-quality-control/src/release-subject.ts';
import {browserProfiles} from '../services/vii-quality-control/src/browser-profiles.ts';
import {claimQualityJob,startQualityJobCheck,commitQualityJobCheck,finishQualityJobSlice,ensureQualityJobSchema} from '../app/lib/quality-job-store.ts';
import {readPrivateReleaseAuthority} from '../tools/release-private-authority.mjs';
import {discoveryEvidenceValidUntil}from'../app/lib/quality-readiness.ts';

const root=process.cwd(),hash=b=>createHash('sha256').update(b).digest('hex'),buildId='11111111-2222-3333-4444-555555555555';
const contract=JSON.parse(readFileSync('project_knowledge/release_controls/vii-private-quality-resources.json','utf8'));
async function setup(options={}) {
  const f=fixture(),directory=mkdtempSync(join(root,'.qa-output','private-authority-test-'));
  const env={...f.env,RELEASE_AUTHORITY_ENABLED:'true',AUTHORITY_ENABLED:'true',BROWSER_ENABLED:'true',EXPECTED_SOURCE_VERSION:'a'.repeat(40),EXPECTED_APP_SOURCE_VERSION:'b'.repeat(40),EXPECTED_BROWSER_SOURCE_VERSION:'c'.repeat(40),EXPECTED_BUILD_ID:buildId,PUBLIC_ORIGIN:'https://vii.spaplus.co'};
  const descriptor={schemaVersion:1,candidateSource:'d'.repeat(40),candidateTree:'e'.repeat(40),applicationSource:env.EXPECTED_APP_SOURCE_VERSION,controllerSource:env.EXPECTED_SOURCE_VERSION,browserSource:env.EXPECTED_BROWSER_SOURCE_VERSION,buildId,artifactSetSha256:'1'.repeat(64),environmentSetSha256:'2'.repeat(64),definitionSetSha256:await releaseDefinitionSetSha256(env),issuedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+3_600_000).toISOString()};
  const {subjectId}=await registerReleaseSubject(env,descriptor,'fixture-owner');
  await ensureQualityJobSchema(f.db);
  const unitArtifacts=[],packages={};
  for(const unit of ['quality-controller','quality-browser']) {
    const bytes=Buffer.from(`export default {fetch(){return new Response('${unit} fixture')}};`),source=unit==='quality-controller'?env.EXPECTED_SOURCE_VERSION:env.EXPECTED_BROWSER_SOURCE_VERSION;
    const pkg={schemaVersion:1,unit,source,entrypoint:'index.js',modules:[{name:'index.js',sha256:hash(bytes),bytes:bytes.length,body:bytes.toString('base64')}]};
    const raw=Buffer.from(JSON.stringify(pkg)),path=join(directory,unit+'.json');writeFileSync(path,raw);packages[unit]=pkg;
    unitArtifacts.push({unit,source,artifact:{path,sha256:hash(raw)}});
  }
  const calls=[],deploymentReads={};
  const fetcher=async(input,init)=>{
    const url=new URL(input),prefix=`/client/v4/accounts/${contract.accountId}`;
    assert.equal(url.origin,'https://api.cloudflare.com');assert.ok(url.pathname.startsWith(prefix));assert.equal(init.headers.Authorization,'Bearer synthetic-provider-read-token');assert.equal(init.redirect,'error');assert.ok(init.signal);
    const path=url.pathname.slice(prefix.length);calls.push({path,method:init.method});
    if(options.httpError)return new Response('secret upstream detail must not become evidence',{status:503});
    let result;
    const unit=path.includes('vii-quality-browser')?'quality-browser':'quality-controller',worker=contract.units[unit].worker;
    const versionId=unit==='quality-controller'?'aaaaaaaa-1111-2222-3333-444444444444':'bbbbbbbb-1111-2222-3333-444444444444';
    if(path===`/workers/scripts/${worker}/deployments`) {
      deploymentReads[unit]=(deploymentReads[unit]??0)+1;
      result={deployments:[{id:options.generationChange&&deploymentReads[unit]>1?'ffffffff-1111-2222-3333-444444444444':'dddddddd-1111-2222-3333-444444444444',versions:[{version_id:versionId,percentage:options.split?50:100}]}]};
    }else if(path===`/workers/scripts/${worker}/versions/${versionId}`) {
      const vars=unit==='quality-controller'?env:{EXPECTED_SOURCE_VERSION:env.EXPECTED_BROWSER_SOURCE_VERSION,EXPECTED_BUILD_ID:buildId,PUBLIC_ORIGIN:env.PUBLIC_ORIGIN};
      result={id:versionId,resources:{bindings:[...contract.units[unit].bindings,...Object.entries(vars).filter(([,v])=>typeof v==='string').map(([name,text])=>({name,text:options.disabled&&name==='RELEASE_AUTHORITY_ENABLED'?'false':text,type:'plain_text'}))]}};
      if(options.wrongDatabase&&unit==='quality-controller')result.resources.bindings=result.resources.bindings.map(x=>x.name==='QUALITY_DB'?{...x,id:'ffffffff-1111-2222-3333-444444444444'}:x);
    }else if(path===`/workers/scripts/${worker}/subdomain`)result={enabled:!!options.publicAccess,previews_enabled:false};
    else if(path===`/workers/scripts/${worker}/content/v2`) {
      assert.equal(url.search,`?version=${versionId}`);
      const form=new FormData();
      for(const m of packages[unit].modules)form.append(m.name,new Blob([options.tamperedCode?'wrong actual Worker bytes':Buffer.from(m.body,'base64')],{type:'application/javascript+module'}),m.name);
      const response=new Response(form);response.headers.set('cf-entrypoint','index.js');return response;
    }else if(path===`/d1/database/${contract.units['quality-controller'].bindings[0].id}`)result={uuid:contract.units['quality-controller'].bindings[0].id,name:'vii-quality-control'};
    else if(path.endsWith('/query')) {
      assert.equal(init.method,'POST');const input=JSON.parse(init.body);assert.equal(input.batch.length,2);
      result=input.batch.map(({sql,params})=>{assert.ok(sql.startsWith('SELECT '));assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP)\b/);return{success:true,meta:{rows_written:options.reportedWrite?1:0,changes:0,changed_db:false},results:f.sqlite.prepare(sql).all(...params)};});
    }else throw Error('unexpected provider request '+path);
    return Response.json({success:true,result});
  };
  async function completeAll() {
    for(const key of ['http-full',...browserProfiles.map(p=>`browser:${p.profileId}`)]) {
      const {job}=await enqueueReleaseCheck(env,subjectId,key),leaseToken=crypto.randomUUID();
      await claimQualityJob(f.db,job.runId,{leaseToken,now:new Date().toISOString(),leaseUntil:new Date(Date.now()+60_000).toISOString()});
      for(let index=0;index<job.checks.length;index++){const now=new Date().toISOString();await startQualityJobCheck(f.db,{runId:job.runId,leaseToken,index,now});await commitQualityJobCheck(f.db,{runId:job.runId,leaseToken,index,now,receipt:{checkId:job.checks[index].checkId,status:'passed',observed:'controlled fixture',checkedAt:now,...(job.checks[index].configuration.check?.semanticContract?{evidenceValidUntil:discoveryEvidenceValidUntil({cache:{checkedAt:now}},Date.parse(now))}:{})}});}
      await finishQualityJobSlice(f.db,{runId:job.runId,leaseToken,status:'completed',now:new Date().toISOString()});
    }
  }
  return {subjectId,descriptor,calls,completeAll,input:{subjectId,expected:descriptor,unitArtifacts,token:'synthetic-provider-read-token',root,fetcher},close(){f.sqlite.close();assert.ok(relative(resolve(root,'.qa-output'),directory).startsWith('private-authority-test-'));rmSync(directory,{recursive:true});}};
}

test('provider readback compares exact active module bytes, uses only fixed SELECTs and remains incomplete without durable jobs',async()=>{
  const f=await setup();try {
    const report=await readPrivateReleaseAuthority(f.input);
    assert.equal(report.status,'blocked');assert.equal(report.evidence.requiredJobs,35);assert.equal(report.evidence.passedJobs,0);assert.equal(report.providerReadsOnly,true);
    assert.equal(report.publicationApproved,false);assert.equal(report.publicReleaseVerified,false);
    assert.equal(f.calls.filter(x=>x.method==='POST').length,1);assert.equal(f.calls.filter(x=>x.method==='POST')[0].path.endsWith('/query'),true);
    assert.equal(JSON.stringify(report).includes('synthetic-provider-read-token'),false);
  }finally{f.close();}
});

test('all durable passed jobs plus exact provider code/context produce runtime evidence only, with no publication approval',async()=>{
  const f=await setup();try {
    await f.completeAll();const report=await readPrivateReleaseAuthority(f.input);
    assert.equal(report.status,'passed');assert.equal(report.evidence.passedJobs,35);assert.equal(report.publicationApproved,false);
    await assert.rejects(readPrivateReleaseAuthority({...f.input,expected:{...f.descriptor,artifactSetSha256:'f'.repeat(64)}}),/candidate_context_mismatch/);
    await assert.rejects(readPrivateReleaseAuthority({...f.input,expected:{...f.descriptor,environmentSetSha256:'f'.repeat(64)}}),/candidate_context_mismatch/);
  }finally{f.close();}
});

test('mixed generations, wrong bindings, public access, disabled authority and different deployed bytes fail closed',async()=>{
  for(const [options,reason] of [[{split:true},/single_generation/],[{wrongDatabase:true},/binding_mismatch/],[{publicAccess:true},/public_access_enabled/],[{disabled:true},/not_activated/],[{tamperedCode:true},/deployed_artifact_mismatch/],[{reportedWrite:true},/snapshot_invalid/],[{generationChange:true},/generation_changed/]]) {
    const f=await setup(options);try{await assert.rejects(readPrivateReleaseAuthority(f.input),reason);}finally{f.close();}
  }
});

test('provider failure and malformed input never retry, import a caller receipt or send authorization elsewhere',async()=>{
  const f=await setup({httpError:true});try {
    await assert.rejects(readPrivateReleaseAuthority(f.input),/provider_http_503/);assert.equal(f.calls.length,1);
    await assert.rejects(readPrivateReleaseAuthority({...f.input,subjectId:'bad'}),/input_invalid/);assert.equal(f.calls.length,1);
    const original=f.input.unitArtifacts[0].artifact.sha256;f.input.unitArtifacts[0].artifact.sha256='0'.repeat(64);
    await assert.rejects(readPrivateReleaseAuthority(f.input),/artifact_digest_mismatch/);assert.equal(f.calls.length,1);f.input.unitArtifacts[0].artifact.sha256=original;
  }finally{f.close();}
});
