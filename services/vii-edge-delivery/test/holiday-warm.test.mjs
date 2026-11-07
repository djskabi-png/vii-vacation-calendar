import test from 'node:test';
import assert from 'node:assert/strict';
import { warmHolidaySnapshots } from '../src/holiday-warm.ts';
import worker from '../src/index.ts';

const origin='https://vii-vacation-calendar.adir-naor-7510.chatgpt.site',build='qualified-build';
const json=body=>Response.json(body,{headers:{'X-VII-App-Build':build}});
const verified=id=>({holiday:{id},availabilityStatus:'verified',deals:[{siteID:1}],cache:{checkedAt:new Date().toISOString()}});

test('six visible holidays use at most two anonymous read-only requests concurrently and preserve exact CMS stays',async()=>{
 const requests=[];let active=0,max=0;
 const fetcher=async request=>{requests.push(request);const url=new URL(request.url);if(url.pathname.endsWith('home-holidays'))return json({holidays:Array.from({length:6},(_,i)=>({id:i+1,...(i===0?{exactStay:true,from:'2026-12-04',till:'2026-12-06'}:{})}))});active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return json(verified(Number(url.searchParams.get('id'))));};
 const report=await warmHolidaySnapshots({origin,build,fetcher});
 assert.equal(report.verified,6);assert.equal(report.failed,0);assert.equal(max,2);assert.equal(requests.length,7);
 for(const request of requests){assert.equal(request.method,'GET');assert.equal(request.redirect,'manual');assert.equal(request.headers.get('Accept'),'application/json');assert.equal(request.headers.has('Cookie'),false);assert.equal(request.headers.has('Authorization'),false);assert.equal(new URL(request.url).origin,origin);}
 const exact=new URL(requests[1].url);assert.equal(exact.searchParams.get('from'),'2026-12-04');assert.equal(exact.searchParams.get('till'),'2026-12-06');assert.equal(exact.searchParams.get('guests'),'2');assert.equal(exact.searchParams.get('part'),'all');assert.equal(new URL(requests[2].url).searchParams.has('from'),false);
});

test('pending provider snapshots are observed once, never polled or counted as verified',async()=>{
 let reads=0;const report=await warmHolidaySnapshots({origin,build,fetcher:async request=>{reads++;return json(new URL(request.url).pathname.endsWith('home-holidays')?{holidays:[{id:114}]}:{holiday:{id:114},availabilityStatus:'refreshing',deals:[]});}});
 assert.equal(reads,2);assert.deepEqual(report,{attempted:1,verified:0,preparing:1,failed:0});
});

test('failed, expired and wrong-holiday responses cannot become successful readiness evidence',async()=>{
 for(const result of [{...verified(1),holiday:{id:2}}, {...verified(1),cache:{checkedAt:new Date(Date.now()-3600001).toISOString()}}, {...verified(1),availabilityStatus:'unknown'}, {...verified(1),deals:null}]){
  const report=await warmHolidaySnapshots({origin,build,fetcher:async request=>json(new URL(request.url).pathname.endsWith('home-holidays')?{holidays:[{id:1}]}:result)});assert.equal(report.failed,1);assert.equal(report.verified,0);
 }
});

test('foreign origins, pending builds, mismatched active builds and oversized bodies fail closed',async()=>{
 for(const options of [{origin:'https://attacker.invalid',build},{origin,build:'pending-next'}])await assert.rejects(warmHolidaySnapshots({...options,fetcher:async()=>{throw Error('must not read')}}),/identity/);
 await assert.rejects(warmHolidaySnapshots({origin,build,fetcher:async()=>Response.json({holidays:[]},{headers:{'X-VII-App-Build':'old'}})}),/response/);
 await assert.rejects(warmHolidaySnapshots({origin,build,fetcher:async()=>json({holidays:[],junk:'x'.repeat(1024*1024)})}),/body_too_large/);
});

test('invalid or duplicate calendar identities cause no detail requests',async()=>{
 for(const holidays of [[{id:1},{id:1}],[{id:'1'}],[{id:0}],[{id:1,exactStay:true,from:'broken',till:'2026-12-06'}],Array.from({length:7},(_,i)=>({id:i+1}))]){
  let reads=0;await assert.rejects(warmHolidaySnapshots({origin,build,fetcher:async()=>{reads++;return json({holidays})}}));assert.equal(reads,1);
 }
});

test('admission deadline stops additional work without another supplier retry',async()=>{
 let now=0,reads=0;const report=await warmHolidaySnapshots({origin,build,now:()=>now,fetcher:async request=>{reads++;if(new URL(request.url).pathname.endsWith('home-holidays'))return json({holidays:[{id:1},{id:2},{id:3}]});now=55001;return json(verified(1));}});assert.equal(reads,2);assert.equal(report.attempted,1);
});

test('installed edge scheduler actually invokes the holiday warmer independently of managed application cron',async()=>{
 const old=globalThis.fetch;let calendar=0,details=0;const tasks=[];
 globalThis.fetch=async request=>{const path=new URL(request.url).pathname;if(path==='/api/vii/home-holidays'){calendar++;return json({holidays:[{id:114}]});}if(path==='/api/vii/home-holiday-deals'){details++;return json(verified(114));}return new Response('html',{headers:{'Content-Type':path.endsWith('.rsc')?'text/x-component':'text/html','X-VII-Cache-Build':build,'X-VII-Cache-Until':String(Date.now()+100000)}});};
 try{await worker.scheduled({scheduledTime:Date.now(),cron:'*/2 * * * *'},{EXPECTED_BUILD:build,ORIGIN:origin},{waitUntil(p){tasks.push(p)}});await Promise.allSettled(tasks);assert.equal(calendar,1);assert.equal(details,1);}finally{globalThis.fetch=old;}
});
