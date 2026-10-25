import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import worker from '../dist/server/index.js';

const env={ASSETS:{fetch:async()=>new Response('Not found',{status:404})}};
function context(){const jobs=[];return{waitUntil(p){jobs.push(p)},passThroughOnException(){},async settle(){while(jobs.length)await Promise.all(jobs.splice(0))}}}
const rows=[];
for(const world of ['vacations','events','rooms','spa']){
  const path=`/api/catalog?world=${world}&view=lookup`;
  const pending=Array.from({length:8},()=>context());
  const start=performance.now();
  const responses=await Promise.all(pending.map(ctx=>worker.fetch(new Request('https://vii.spaplus.co'+path,{headers:{Accept:'application/json'}}),env,ctx)));
  const bodies=await Promise.all(responses.map(response=>response.text()));
  await Promise.all(pending.map(ctx=>ctx.settle()));
  responses.forEach(response=>assert.equal(response.status,200));
  bodies.forEach(body=>assert.equal(body,bodies[0],'coalesced catalog diverged'));
  const captures=responses.map(response=>response.headers.get('X-VII-Cache-Capture'));
  // Captures may finish between response headers, so total admitted across a
  // burst is not concurrent work. Exact overlapping cap is tested by fixture.
  assert.ok(captures.every(state=>state===null||state==='queued'||state==='busy'));
  rows.push({world,requests:8,captures:captures.filter(state=>state==='queued').length,busy:captures.filter(state=>state==='busy').length,elapsedMs:Math.round(performance.now()-start),bytes:Buffer.byteLength(bodies[0]),hash:createHash('sha256').update(bodies[0]).digest('hex')});
}
for(const path of ['/spas','/spas.rsc?_rsc','/en/spas','/api/catalog?world=spa&view=lookup']){
  const navigation=path.includes('.rsc');const data=path.startsWith('/api/');
  const headers={Accept:data?'application/json':navigation?'text/x-component':'text/html'};if(navigation)headers.RSC='1';
  const ctx=context();
  const response=await worker.fetch(new Request('https://vii.spaplus.co'+path,{headers:{...headers,Cookie:'vii_customer_session=invalid-probe'}}),env,ctx);
  await response.arrayBuffer();await ctx.settle();
  assert.equal(response.headers.get('X-VII-Cache-Fill'),null);
  assert.equal(response.headers.get('X-VII-Cache-Layer'),null);
}
console.log(JSON.stringify({scope:'Actual built Worker, local approved bundled fixtures, one isolate; not a distributed production load test. Origin coalescing was rejected after first experiment,not shipped.',rows,privateBypass:'passed',verdict:'passed'},null,2));
