import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite/package.json')]}));
const {Miniflare,Log,LogLevel}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
const source='a'.repeat(40),buildId='11111111-2222-3333-4444-555555555555';

test('actual private controller uses Worker Service Binding and D1 without rewriting browser identity',{timeout:20000},async()=>{
 const entry=`
import {createController,jobView} from './services/vii-quality-control/src/controller.ts';
import {readQualityJob} from './app/lib/quality-job-store.ts';
let messages=[],legacyCalls=0;
const controller=createController({create:async()=>{throw Error('legacy create forbidden')},consume:async()=>{legacyCalls++;throw Error('legacy consume forbidden')}});
export default {async fetch(request,bindings){
 const input=await request.json();
 const env={...bindings,RELEASE_QUEUE:{send:async message=>{messages.push(message)}},MONITOR_QUEUE:{send:async()=>{throw Error('monitor forbidden')}},EXECUTION_ENABLED:'true',BROWSER_ENABLED:'true',EXPECTED_SOURCE_VERSION:'${source}',EXPECTED_BUILD_ID:'${buildId}',PUBLIC_ORIGIN:'https://vii.spaplus.co'};
 if(input.command==='enqueue')return controller.handle(new Request('https://vii.spaplus.co/api/admin/quality',{method:'POST'}),env,'trusted-runtime-fixture',{action:'enqueue-browser',profileId:input.profileId,idempotencyKey:input.key});
 const message=messages.find(value=>value.runId===input.jobId);
 if(!message)return Response.json({error:'message missing'},{status:404});
 await controller.consume(env,message);
 return Response.json({job:jobView(await readQualityJob(bindings.QUALITY_DB,input.jobId)),legacyCalls,messages:messages.length});
}};`;
 const compiled=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,external:['cloudflare:workers']});
 const browser=`let calls=0;export default {async fetch(request){calls++;const job=await request.json();if(request.headers.has('cookie')||request.headers.has('authorization'))return Response.json({error:'identity leaked'},{status:403});return Response.json({...job,buildId:job.world==='events'?'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee':job.buildId,status:'passed',steps:3,requestCount:calls,durationMs:12});}};`;
 const mf=new Miniflare({log:new Log(LogLevel.WARN),workers:[
  {name:'control',modules:[{type:'ESModule',path:'browser-control.mjs',contents:compiled.outputFiles[0].text}],compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat'],d1Databases:{QUALITY_DB:'browser-d1'},serviceBindings:{QUALITY_BROWSER:'browser'}},
  {name:'browser',modules:[{type:'ESModule',path:'browser.mjs',contents:browser}],compatibilityDate:'2026-05-22'},
 ]});
 try{
  const control=await mf.getWorker('control');
  async function call(input){const response=await control.fetch('https://fixture.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(response.status,input.command==='enqueue'?202:200,await response.clone().text());return response.json();}
  const first=await call({command:'enqueue',key:'runtime-browser-1',profileId:'vacations-mobile-world-shell'});
  assert.equal(first.job.executionKind,'browser');assert.equal(first.job.sourceVersion,source);assert.equal(first.job.buildId,buildId);
  const completed=await call({command:'consume',jobId:first.job.runId});assert.equal(completed.job.status,'completed');assert.equal(completed.job.receipts[0].status,'passed');assert.equal(completed.job.receipts[0].durationMs,12);assert.equal(completed.legacyCalls,0);
  const duplicate=await call({command:'consume',jobId:first.job.runId});assert.deepEqual(duplicate.job.receipts,completed.job.receipts);assert.equal(duplicate.messages,1);
  const second=await call({command:'enqueue',key:'runtime-browser-2',profileId:'events-mobile-world-shell'});
  const blocked=await call({command:'consume',jobId:second.job.runId});assert.equal(blocked.job.status,'blocked');assert.equal(blocked.job.receipts.length,0);assert.equal(blocked.legacyCalls,0);
 }finally{await mf.dispose();}
});
