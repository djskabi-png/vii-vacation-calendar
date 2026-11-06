import {readFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {qualityJobSelectSql} from '../app/lib/quality-job-store.ts';
import {readReleaseSubjectEvidence} from '../services/vii-quality-control/src/release-subject.ts';

const CONTRACT='project_knowledge/release_controls/vii-private-quality-resources.json';
const DIGEST=/^[a-f0-9]{64}$/, SHA=/^[a-f0-9]{40}$/, UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const normalize=sql=>sql.replace(/\s+/g,' ').trim();
const SUBJECT_SQL='SELECT subject_id AS subjectId,descriptor_json AS descriptorJson,registered_at AS registeredAt,registered_by AS registeredBy FROM quality_release_subjects WHERE subject_id=?';
const JOB_SQL=qualityJobSelectSql+' WHERE actor=? ORDER BY idempotency_key LIMIT 101';
const IDENTITY_KEYS=['candidateSource','candidateTree','applicationSource','controllerSource','browserSource','buildId','artifactSetSha256','environmentSetSha256'];

async function bounded(response,maxBytes,signal) {
  if(!response.body)throw Error('authority_response_empty');
  const reader=response.body.getReader(),parts=[];let size=0;
  const cancel=()=>{void reader.cancel().catch(()=>undefined);};signal.addEventListener('abort',cancel,{once:true});
  try{while(true){if(signal.aborted)throw Error('authority_read_deadline');const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>maxBytes)throw Error('authority_response_oversized');parts.push(next.value);}}
  finally{signal.removeEventListener('abort',cancel);void reader.cancel().catch(()=>undefined);reader.releaseLock();}
  if(signal.aborted)throw Error('authority_read_deadline');return Buffer.concat(parts);
}
function packageValue(entry,root,unit) {
  if(entry?.unit!==unit||!DIGEST.test(entry.artifact?.sha256??'')||typeof entry.artifact.path!=='string')throw Error('authority_artifact_missing');
  const path=realpathSync(resolve(root,entry.artifact.path)),rel=relative(realpathSync(root),path);
  if(!rel||rel.startsWith('..')||isAbsolute(rel)||!statSync(path).isFile()||statSync(path).size>40*1024*1024)throw Error('authority_artifact_path_invalid');
  const bytes=readFileSync(path);
  if(bytes.length>40*1024*1024||hash(bytes)!==entry.artifact.sha256)throw Error('authority_artifact_digest_mismatch');
  const pkg=JSON.parse(bytes.toString('utf8'));
  if(pkg.schemaVersion!==1||pkg.unit!==unit||pkg.source!==entry.source||!SHA.test(pkg.source)||pkg.entrypoint!=='index.js'||!Array.isArray(pkg.modules)||!pkg.modules.length||pkg.modules.length>256)throw Error('authority_artifact_invalid');
  for(const m of pkg.modules)if(typeof m.name!=='string'||!DIGEST.test(m.sha256??'')||!Number.isSafeInteger(m.bytes)||m.bytes<0||m.bytes>16*1024*1024)throw Error('authority_artifact_invalid');
  if(new Set(pkg.modules.map(m=>m.name)).size!==pkg.modules.length)throw Error('authority_artifact_invalid');
  return pkg;
}
function readModelDatabase(subject,rows,subjectId) {
  // The server's normal read functions are reused against an authenticated,
  // bounded provider snapshot. No schema initialization or SQL execution here.
  const jobs=new Map();
  for(const row of rows){if(row.actor!==`release:${subjectId}`||typeof row.idempotencyKey!=='string'||jobs.has(row.idempotencyKey))throw Error('authority_job_snapshot_invalid');jobs.set(row.idempotencyKey,row);}
  return {prepare(sql){let args;const key=normalize(sql);return{bind(...values){args=values;return this;},async first(){
    if(key===normalize(SUBJECT_SQL)&&args?.length===1&&args[0]===subjectId)return subject;
    if(key===normalize(qualityJobSelectSql+' WHERE actor=? AND idempotency_key=?')&&args?.length===2&&args[0]===`release:${subjectId}`)return jobs.get(args[1])??null;
    throw Error('authority_read_query_not_allowed');
  },async run(){throw Error('authority_mutation_forbidden');}};},async batch(){throw Error('authority_mutation_forbidden');}};
}

/** Authenticated Cloudflare readback, never a caller-provided receipt import.
 * Context hashes must come from independently audited candidate evidence. This
 * proves only this runtime suite; it does not confer publication authority. */
export async function readPrivateReleaseAuthority({subjectId,expected,unitArtifacts,token,root=process.cwd(),fetcher=fetch,clock=Date.now}) {
  if(!DIGEST.test(subjectId??'')||!token||typeof token!=='string'||!Array.isArray(unitArtifacts)||!expected||IDENTITY_KEYS.some(key=>typeof expected[key]!=='string'))throw Error('authority_read_input_invalid');
  for(const key of ['candidateSource','candidateTree','applicationSource','controllerSource','browserSource'])if(!SHA.test(expected[key]))throw Error('authority_read_input_invalid');
  if(!UUID.test(expected.buildId)||![expected.artifactSetSha256,expected.environmentSetSha256].every(x=>DIGEST.test(x)))throw Error('authority_read_input_invalid');
  const contract=JSON.parse(execFileSync('git',['show',`HEAD:${CONTRACT}`],{cwd:root,encoding:'utf8',windowsHide:true}));
  if(contract.schemaVersion!==1||!/^[a-f0-9]{32}$/.test(contract.accountId))throw Error('authority_resource_contract_invalid');
  const control=contract.units?.['quality-controller'],browser=contract.units?.['quality-browser'];
  const db=control?.bindings.find(x=>x.name==='QUALITY_DB'&&x.type==='d1');
  if(!control?.worker||!browser?.worker||!UUID.test(db?.id??''))throw Error('authority_resource_contract_invalid');
  const packages=new Map(['quality-controller','quality-browser'].map(unit=>[unit,packageValue(unitArtifacts.find(x=>x.unit===unit),root,unit)]));
  if(packages.get('quality-controller').source!==expected.controllerSource||packages.get('quality-browser').source!==expected.browserSource)throw Error('authority_artifact_source_mismatch');
  const start=clock(),deadline=start+60_000,signal=AbortSignal.timeout(60_000),transcript=[];
  async function api(path,{body,bytes=false,maxBytes=2*1024*1024}={}) {
    if(clock()>=deadline||signal.aborted)throw Error('authority_read_deadline');
    const url=`https://api.cloudflare.com/client/v4/accounts/${contract.accountId}${path}`;
    const response=await fetcher(url,{method:body?'POST':'GET',redirect:'error',signal,headers:{Authorization:`Bearer ${token}`,Accept:bytes?'*/*':'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok){void response.body?.cancel().catch(()=>undefined);throw Error(`authority_provider_http_${response.status}`);}
    const raw=await bounded(response,maxBytes,signal);
    transcript.push({path,method:body?'POST':'GET',sha256:hash(raw),bytes:raw.length});
    if(bytes)return {raw,contentType:response.headers.get('content-type'),entrypoint:response.headers.get('cf-entrypoint')};
    let payload;try{payload=JSON.parse(raw.toString('utf8'));}catch{throw Error('authority_provider_json_invalid');}
    if(payload.success!==true)throw Error('authority_provider_unsuccessful');return payload.result;
  }
  async function deployment(worker) {
    const result=await api(`/workers/scripts/${worker}/deployments`),current=result?.deployments?.[0];
    if(!UUID.test(current?.id??'')||current.versions?.length!==1||current.versions[0].percentage!==100||!UUID.test(current.versions[0].version_id??''))throw Error('authority_deployment_not_single_generation');
    return {deploymentId:current.id,versionId:current.versions[0].version_id};
  }
  const observations=[];
  for(const unit of ['quality-controller','quality-browser']) {
    const resource=contract.units[unit],active=await deployment(resource.worker);
    const version=await api(`/workers/scripts/${resource.worker}/versions/${active.versionId}`);
    if(version.id!==active.versionId||!Array.isArray(version.resources?.bindings))throw Error('authority_version_invalid');
    const bindings=version.resources.bindings;
    if(new Set(bindings.map(x=>x.name)).size!==bindings.length)throw Error('authority_bindings_invalid');
    for(const required of resource.bindings)if(!bindings.some(value=>Object.entries(required).every(([key,val])=>value[key]===val)))throw Error('authority_binding_mismatch');
    const vars=Object.fromEntries(bindings.filter(x=>x.type==='plain_text').map(x=>[x.name,x.text]));
    if(vars.PUBLIC_ORIGIN!=='https://vii.spaplus.co'||vars.EXPECTED_BUILD_ID!==expected.buildId||vars.EXPECTED_SOURCE_VERSION!==expected[unit==='quality-controller'?'controllerSource':'browserSource'])throw Error('authority_runtime_generation_mismatch');
    if(unit==='quality-controller'&&(vars.EXPECTED_APP_SOURCE_VERSION!==expected.applicationSource||vars.EXPECTED_BROWSER_SOURCE_VERSION!==expected.browserSource))throw Error('authority_runtime_generation_mismatch');
    if(unit==='quality-controller'&&['AUTHORITY_ENABLED','RELEASE_AUTHORITY_ENABLED','EXECUTION_ENABLED','BROWSER_ENABLED'].some(key=>vars[key]!=='true'))throw Error('authority_runtime_not_activated');
    const access=await api(`/workers/scripts/${resource.worker}/subdomain`);
    if(access.enabled!==false||access.previews_enabled!==false)throw Error('authority_public_access_enabled');
    // Same version-specific content route used by the installed official Wrangler.
    const content=await api(`/workers/scripts/${resource.worker}/content/v2?version=${active.versionId}`,{bytes:true,maxBytes:26*1024*1024});
    const pkg=packages.get(unit);
    if(!content.contentType?.startsWith('multipart/form-data')||content.entrypoint!==pkg.entrypoint)throw Error('authority_module_response_invalid');
    const form=await new Response(content.raw,{headers:{'Content-Type':content.contentType}}).formData(),modules=[];
    for(const [name,value] of form){if(typeof value==='string')throw Error('authority_module_response_invalid');const bytes=Buffer.from(await value.arrayBuffer());modules.push({name,sha256:hash(bytes),bytes:bytes.length});}
    modules.sort((a,b)=>a.name.localeCompare(b.name));
    const expectedModules=pkg.modules.map(({name,sha256,bytes})=>({name,sha256,bytes})).sort((a,b)=>a.name.localeCompare(b.name));
    if(JSON.stringify(modules)!==JSON.stringify(expectedModules))throw Error('authority_deployed_artifact_mismatch');
    observations.push({unit,worker:resource.worker,...active,vars,access,modules,configurationSha256:hash(JSON.stringify(version.resources))});
  }
  const metadata=await api(`/d1/database/${db.id}`);
  if(metadata?.uuid!==db.id||metadata.name!=='vii-quality-control')throw Error('authority_database_mismatch');
  // Only two fixed parameterized SELECTs, one bounded provider batch. No schema,
  // job creation, mutation, dispatch, arbitrary SQL or request retry is possible.
  const result=await api(`/d1/database/${db.id}/query`,{body:{batch:[{sql:SUBJECT_SQL,params:[subjectId]},{sql:JOB_SQL,params:[`release:${subjectId}`]}]}});
  if(!Array.isArray(result)||result.length!==2||result.some(x=>x.success!==true||!Array.isArray(x.results)||Number(x.meta?.rows_written??0)!==0||Number(x.meta?.changes??0)!==0||x.meta?.changed_db===true)||result[0].results.length!==1||result[1].results.length>100)throw Error('authority_database_snapshot_invalid');
  const controller=observations.find(x=>x.unit==='quality-controller');
  const env={...controller.vars,QUALITY_DB:readModelDatabase(result[0].results[0],result[1].results,subjectId)};
  const evidence=await readReleaseSubjectEvidence(env,subjectId,clock(),{initializeSchema:false});
  if(IDENTITY_KEYS.some(key=>evidence.descriptor[key]!==expected[key]))throw Error('authority_candidate_context_mismatch');
  for(const observed of observations){const after=await deployment(observed.worker);if(JSON.stringify(after)!==JSON.stringify({deploymentId:observed.deploymentId,versionId:observed.versionId}))throw Error('authority_generation_changed_during_read');}
  if(clock()>=Date.parse(evidence.descriptor.expiresAt)||clock()>=deadline||signal.aborted)throw Error('authority_read_expired');
  return {schemaVersion:1,engine:'cloud-private-runtime-readback',status:evidence.runtimeEvidenceStatus==='passed'?'passed':'blocked',accountId:contract.accountId,databaseId:db.id,observedAt:new Date(clock()).toISOString(),subjectId,evidence,
    workers:observations.map(({vars,...safe})=>safe),transcript,providerReadsOnly:true,publicationApproved:false,publicReleaseVerified:false};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
  // This entry point accepts candidate context, never a file of purported remote
  // results. Authorization stays in process memory and is never written/logged.
  let token=process.env.VII_QUALITY_READ_AUTH;delete process.env.VII_QUALITY_READ_AUTH;
  try{const input=JSON.parse(readFileSync(resolve(process.argv[2]),'utf8').replace(/^\uFEFF/,''));const result=await readPrivateReleaseAuthority({...input,token,root:process.cwd()});console.log(JSON.stringify(result,null,2));if(result.status!=='passed')process.exitCode=1;}
  catch(error){console.log(JSON.stringify({status:'blocked',reason:error instanceof Error&&/^(?:authority_|release_)[a-z0-9_]+$/.test(error.message)?error.message:'authority_read_unavailable',publicationApproved:false,publicReleaseVerified:false}));process.exitCode=1;}
  finally{token=undefined;}
}
