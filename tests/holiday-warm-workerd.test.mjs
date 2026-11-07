import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=require(require.resolve('esbuild',{paths:[require.resolve('vite/package.json')]}));
const {Miniflare,Log,LogLevel}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));

test('actual Workers runtime cron constructs requests and prepares the six real-shaped holiday selections',{timeout:20000},async()=>{
 const buildId='11111111-2222-3333-4444-555555555555';
 const compiled=await build({entryPoints:['services/vii-edge-delivery/src/index.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
 const origin=`let calendar=0;const ids=[];export default {async fetch(request){const u=new URL(request.url);if(u.pathname==='/__stats')return Response.json({calendar,ids});if(request.method!=='GET'||request.headers.has('Cookie')||request.headers.has('Authorization'))return new Response('forbidden',{status:403});if(u.pathname==='/api/vii/home-holidays'){calendar++;return Response.json({holidays:[1,2,3,4,5,6].map(id=>({id}))},{headers:{'X-VII-App-Build':'${buildId}'}});}if(u.pathname==='/api/vii/home-holiday-deals'){const id=Number(u.searchParams.get('id'));ids.push(id);return Response.json({holiday:{id},availabilityStatus:'verified',deals:[],cache:{checkedAt:new Date().toISOString()}},{headers:{'X-VII-App-Build':'${buildId}'}});}return new Response('fixture',{headers:{'Content-Type':u.pathname.endsWith('.rsc')?'text/x-component':'text/html','X-VII-Cache-Build':'${buildId}','X-VII-Cache-Until':String(Date.now()+300000)}});}};`;
 const mf=new Miniflare({log:new Log(LogLevel.WARN),workers:[{name:'edge',modules:[{type:'ESModule',path:'edge.mjs',contents:compiled.outputFiles[0].text}],compatibilityDate:'2026-05-22',outboundService:'origin',bindings:{ORIGIN:'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site',EXPECTED_BUILD:buildId}},{name:'origin',modules:[{type:'ESModule',path:'origin.mjs',contents:origin}],compatibilityDate:'2026-05-22'}]});
 try{const edge=await mf.getWorker('edge');assert.equal((await edge.scheduled({cron:'*/2 * * * *'})).outcome,'ok');const target=await mf.getWorker('origin');const stats=await(await target.fetch('https://fixture.invalid/__stats')).json();assert.equal(stats.calendar,1,'calendar request must actually reach the origin, not fail in Request construction');assert.deepEqual(stats.ids.sort((a,b)=>a-b),[1,2,3,4,5,6]);}finally{await mf.dispose();}
});

