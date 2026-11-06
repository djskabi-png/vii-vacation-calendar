import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSignedValue } from '../app/lib/google-auth.ts';
import { ensureAdminGrantSchema } from '../app/lib/admin-grants.ts';
import { verifyQualityAttestation } from '../app/lib/quality-attestation.ts';
import { ensureSchedulerSchema } from '../services/vii-quality-control/src/scheduler.ts';

const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite/package.json')]}));
const {Miniflare,Log,LogLevel,Request:RuntimeRequest}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
const secret='synthetic-quality-workerd-only-secret-2026';
const buildId='7f2325ab-dbef-4327-a11a-2247c01e0d7e';
test('actual source attestation and JWKS execute under workerd and enforce exact delegated target permissions',{timeout:20000},async()=>{
 const bundle=await build({stdin:{contents:`import {POST} from './app/api/admin/quality-attestation/route.ts';import {GET} from './app/.well-known/vii-quality-jwks.json/route.ts';export default {fetch(r){return new URL(r.url).pathname.endsWith('.json')?GET():POST(r)}};`,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,external:['cloudflare:workers'],define:{__VII_CACHE_BUILD_ID__:JSON.stringify(buildId)}});
 // The bundled local binary supports dates through 2026-05-22. This tests
 // real Worker crypto/auth behavior without silently upgrading production tools.
 const controlBundle=await build({entryPoints:['services/vii-quality-control/src/index.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,external:['cloudflare:workers'],define:{__VII_CACHE_BUILD_ID__:JSON.stringify(buildId)}});
 const mf=new Miniflare({log:new Log(LogLevel.WARN),workers:[
  {name:'source',modules:[{type:'ESModule',path:'quality-source-fixture.mjs',contents:bundle.outputFiles[0].text}],compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat'],bindings:{VII_AUTH_SECRET:secret,VII_ADMIN_EMAILS:'owner@example.test',VII_ACCESS_MANAGER_EMAILS:'owner@example.test'},d1Databases:{DB:'quality-source-auth-fixture'}},
  {name:'control',modules:[{type:'ESModule',path:'quality-control-fixture.mjs',contents:controlBundle.outputFiles[0].text}],compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat'],bindings:{PUBLIC_ORIGIN:'https://vii.spaplus.co',EXPECTED_BUILD_ID:buildId,AUTHORITY_ENABLED:'true',EXECUTION_ENABLED:'false'},d1Databases:{QUALITY_DB:'quality-isolated-control-fixture'},outboundService:'source'},
 ]});
 try{
  const db=await mf.getD1Database('DB');await ensureAdminGrantSchema(db);
  await db.prepare('INSERT INTO vii_admin_grants(email,name,google_sub,active,manage_users,permissions_json,version,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?)').bind('viewer@example.test','Viewer','viewer-sub',1,0,JSON.stringify({quality:'view'}),1,'now','fixture').run();
  const session=await createSignedValue({sub:'viewer-sub',email:'viewer@example.test',name:'Viewer',provider:'google',exp:Math.floor(Date.now()/1000)+60},secret);
  const requestBody={method:'GET',path:'/api/admin/quality?scope=metadata',bodyHash:'a'.repeat(64),nonce:'fixture_nonce_1234567890'};
  const request=(body=requestBody,origin='https://vii.spaplus.co',cookie=`vii_admin_session=${session}`)=>new RuntimeRequest('https://vii.spaplus.co/api/admin/quality-attestation',{method:'POST',headers:{origin,'Content-Type':'application/json',cookie},body:JSON.stringify(body)});
  const allowed=await mf.dispatchFetch(request());assert.equal(allowed.status,200);const {token}=await allowed.json();
  const jwks=await mf.dispatchFetch('https://vii.spaplus.co/.well-known/vii-quality-jwks.json');assert.equal(jwks.status,200);const {keys}=await jwks.json();assert.equal(keys.length,1);assert.equal(keys[0].d,undefined);
  const claims=await verifyQualityAttestation(token,{origin:'https://vii.spaplus.co',target:requestBody.path,method:'GET',bodyHash:requestBody.bodyHash,nonce:requestBody.nonce,buildId},keys[0]);assert.equal(claims?.email,'viewer@example.test');
  assert.equal((await mf.dispatchFetch(request({...requestBody,method:'POST'}))).status,403);
  assert.equal((await mf.dispatchFetch(request(requestBody,'https://evil.example'))).status,403);
  assert.equal((await mf.dispatchFetch(request(requestBody,'https://vii.spaplus.co',''))).status,403);
  assert.equal((await mf.dispatchFetch(request({...requestBody,path:'/api/admin/users'}))).status,400);
  assert.equal((await mf.dispatchFetch(request({...requestBody,bodyHash:'invalid'}))).status,503);
  const control=await mf.getWorker('control');
  const bodyHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('')))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const nonce='actual_controller_nonce_123456';
  const authorization=await mf.dispatchFetch(request({...requestBody,bodyHash,nonce}));assert.equal(authorization.status,200);const controllerToken=(await authorization.json()).token;
  const controlHeaders={'X-VII-Quality-Attestation':controllerToken,'X-VII-Quality-Nonce':nonce};
  const metadata=await control.fetch('https://vii.spaplus.co/api/admin/quality?scope=metadata',{headers:controlHeaders});assert.equal(metadata.status,200);assert.equal(Object.keys((await metadata.json()).metadata).length,61);
  assert.equal((await control.fetch('https://vii.spaplus.co/api/admin/quality?scope=metadata',{headers:controlHeaders})).status,409);
  assert.equal((await control.fetch('https://vii.spaplus.co/api/admin/quality?scope=changed',{headers:controlHeaders})).status,403);
  assert.equal((await control.fetch('https://vii.spaplus.co/api/admin/quality?scope=metadata',{headers:{...controlHeaders,cookie:'must-not-cross-boundary=1'}})).status,403);
  const evidenceTarget='/api/admin/quality?evidence=1&jobId=unknown-job-id';
  const evidenceNonce='historical_evidence_read_123456789';
  const evidenceAuth=await mf.dispatchFetch(request({method:'GET',path:evidenceTarget,bodyHash,nonce:evidenceNonce}));assert.equal(evidenceAuth.status,200);
  const evidenceToken=(await evidenceAuth.json()).token;
  // A read-only source grant authorizes this exact evidence lookup, not another
  // job or an arbitrary R2 key. Missing data is404 after verified authorization.
  const evidenceHeaders={'X-VII-Quality-Attestation':evidenceToken,'X-VII-Quality-Nonce':evidenceNonce};
  assert.equal((await control.fetch('https://vii.spaplus.co'+evidenceTarget.replace('unknown-job-id','other-job-id'),{headers:evidenceHeaders})).status,403);
  assert.equal((await control.fetch('https://vii.spaplus.co'+evidenceTarget,{headers:evidenceHeaders})).status,404);
  // The existing source grant remains authoritative for a real private write.
  await db.prepare('UPDATE vii_admin_grants SET permissions_json=? WHERE email=?').bind(JSON.stringify({quality:'edit'}),'viewer@example.test').run();
  const controlDb=await mf.getD1Database('QUALITY_DB','control');await ensureSchedulerSchema(controlDb);
  await controlDb.prepare("INSERT INTO quality_scheduler_admissions(check_id,bucket,generation,status,created_at) VALUES(?,?,?,'unknown',?)").bind('global.home.semantic',2,'fixture-generation',600000).run();
  const recoveryBody={action:'scheduler-reconcile',checkId:'global.home.semantic',bucket:2,mode:'allow-next'};
  const recoveryJson=JSON.stringify(recoveryBody),recoveryHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(recoveryJson)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  for(const suffix of ['first','repeat']) {
    const recoveryNonce=`recovery_nonce_${suffix}_1234567890`;
    const authorization=await mf.dispatchFetch(request({method:'POST',path:'/api/admin/quality',bodyHash:recoveryHash,nonce:recoveryNonce}));assert.equal(authorization.status,200);
    const result=await control.fetch('https://vii.spaplus.co/api/admin/quality',{method:'POST',headers:{'Content-Type':'application/json','X-VII-Quality-Attestation':(await authorization.json()).token,'X-VII-Quality-Nonce':recoveryNonce},body:recoveryJson});assert.equal(result.status,200);assert.equal((await result.json()).reconciliation.status,'operator-cleared');
  }
  assert.equal((await controlDb.prepare('SELECT COUNT(*) AS n FROM quality_scheduler_reconciliation_audit').first()).n,1);
 }finally{await mf.dispose();}
});
