import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite/package.json')]}));
const {Miniflare,Log,LogLevel}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
const buildId='11111111-2222-3333-4444-555555555555';

test('actual scheduled handler reaches real Queue and D1, fences an old build and passes only matching synthetic content',{timeout:20000},async()=>{
 const compiled=await build({entryPoints:['services/vii-quality-control/src/index.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,external:['cloudflare:workers'],define:{__VII_CACHE_BUILD_ID__:JSON.stringify(buildId)}});
 for(const matching of [false,true]){
  const observed=matching?buildId:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const origin=`let probes=0,checks=0;export default{async fetch(request){const url=new URL(request.url);if(url.pathname==='/__stats')return Response.json({probes,checks});if(request.method!=='GET'||request.headers.has('cookie')||request.headers.has('authorization'))return new Response('forbidden',{status:403});if(request.headers.get('user-agent')==='VII-Quality-Generation/1.0')probes++;else checks++;return new Response('<html><main class="discovery-card">נופש '+ 'synthetic fixture content '.repeat(350)+'</main></html>',{headers:{'Content-Type':'text/html','X-VII-Cache-Build':'${observed}'}});}};`;
  const mf=new Miniflare({log:new Log(LogLevel.WARN),workers:[
   {name:'control',modules:[{type:'ESModule',path:'control-cron.mjs',contents:compiled.outputFiles[0].text}],compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat'],d1Databases:{QUALITY_DB:'cron-runtime-d1'},queueProducers:{RELEASE_QUEUE:'release-runtime-fixture',MONITOR_QUEUE:'monitor-runtime-fixture'},queueConsumers:{'monitor-runtime-fixture':{maxBatchSize:1,maxBatchTimeout:1,maxRetries:0}},outboundService:'origin',bindings:{PUBLIC_ORIGIN:'https://vii.spaplus.co',AUTHORITY_ENABLED:'true',EXECUTION_ENABLED:'true',BROWSER_ENABLED:'false',SCHEDULE_ENABLED:'true',EXPECTED_SOURCE_VERSION:'a'.repeat(40),EXPECTED_BUILD_ID:buildId,SCHEDULE_CHECK_IDS:'["global.home.semantic"]',SCHEDULE_UNTIL:new Date(Date.now()+120000).toISOString()}},
   {name:'origin',modules:[{type:'ESModule',path:'origin.mjs',contents:origin}],compatibilityDate:'2026-05-22'},
  ]});
  try{
   const control=await mf.getWorker('control'),db=await mf.getD1Database('QUALITY_DB','control');
   assert.equal((await control.scheduled({cron:'* * * * *'})).outcome,'ok');
   let row;
   for(const delay of [0,25,50,100,250,500,1000,1000]){
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    row=await db.prepare("SELECT j.run_id,j.status,j.reason,j.next_index,r.status AS run_status,o.status AS dispatch_status FROM quality_jobs j LEFT JOIN quality_runs r ON r.id=j.run_id LEFT JOIN quality_dispatch_outbox o ON o.run_id=j.run_id ORDER BY j.created_at LIMIT 1").first();
    if(row&&['blocked','completed'].includes(row.status)&&row.run_status!=='running'&&row.dispatch_status==='consumed')break;
   }
   assert.equal(row?.status,matching?'completed':'blocked',JSON.stringify(row));assert.equal(row.run_status,matching?'passed':'blocked');assert.equal(row.next_index,matching?1:0);assert.equal(row.dispatch_status,'consumed');
   if(!matching)assert.equal(row.reason,'observed_build_mismatch');
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM quality_jobs').first()).n,1);
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM quality_notification_outbox').first()).n,0);
   assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM quality_results').first()).n,matching?1:0);
   assert.equal((await control.scheduled({cron:'* * * * *'})).outcome,'ok');assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM quality_jobs').first()).n,1);
   const originWorker=await mf.getWorker('origin');assert.deepEqual(await(await originWorker.fetch('https://fixture.invalid/__stats')).json(),{probes:1,checks:matching?1:0});
  }finally{await mf.dispose();}
 }
});
