import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const baseline=JSON.parse(readFileSync(new URL('./fixtures/v822-client-reference-ids.json',import.meta.url)));
const known=new Set(baseline.clientReferenceIds);
const workerPromise=import(new URL('../dist/server/index.js',import.meta.url).href);
for(const [path,world] of [['/spas','spa'],['/hourly','hourly'],['/events','events'],['/vacations/kinneret?guests=2','vacations'],['/events/place/event-779','events'],['/business?id=vacation-164','all']]){
 test(`predecessor client understands actual next-release Flight for ${path}`,async()=>{
  const url=new URL(path,'https://vii.spaplus.co');url.pathname+='.rsc';url.searchParams.set('_rsc','KsQaSH2L7Z4e6Q5N');
  const {default:worker}=await workerPromise;
  const r=await worker.fetch(new Request(url,{headers:{Accept:'text/x-component',RSC:'1','X-Vinext-Interception-Context':'/'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(p){p.catch(()=>{});},passThroughOnException(){}});
  assert.equal(r.status,200);const flight=await r.text();
  const refs=[...new Set([...flight.matchAll(/(?:^|\n)[0-9a-f]+:I\["([^"\n]+)"/g)].map(x=>x[1]))];
  assert.ok(refs.length>5,'exercise real serialized client references');
  assert.deepEqual(refs.filter(id=>!known.has(id)),[],`v822 browser cannot resolve new client modules; a hard reload must not be needed: ${path}`);
  assert.ok(flight.includes(`/assets/vii-public-${world}-`),'destination stylesheet is carried as a native server resource');
 });
}
