import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
const version = process.env.VII_FLIGHT_PREDECESSOR || 'v928';
assert.ok(['v822', 'v928'].includes(version), 'the predecessor must identify a verified client archive');
const receipt = JSON.parse(readFileSync(new URL(`./fixtures/${version}-client-reference-ids.json`, import.meta.url)));
const known = new Set(receipt.clientReferenceIds);
const workerPromise=import(new URL('../dist/server/index.js',import.meta.url).href);
test('the candidate browser registry can load the retained framework shims', () => {
  const directory = new URL('../dist/client/assets/', import.meta.url);
  const entries = readdirSync(directory).filter(name => /^index-[\w-]+\.js$/.test(name));
  assert.equal(entries.length, 1, 'find the real candidate browser entry');
  const entry = readFileSync(new URL(entries[0], directory), 'utf8');
  const references = new Set([...entry.matchAll(/([a-f0-9]{12})"?:async\(\)=>\{/g)].map(([, id]) => id));
  for (const id of Object.keys(receipt.retainedShimExports ?? {})) {
    assert.ok(references.has(id), `candidate browser is missing the retained shim ${id}`);
  }
});
for(const [path,world] of [['/spas','spa'],['/hourly','hourly'],['/events','events'],['/vacations/kinneret?guests=2','vacations'],['/events/place/event-779','events'],['/business?id=vacation-164','all']]){
 test(`predecessor client understands actual next-release Flight for ${path}`,async()=>{
  const url=new URL(path,'https://vii.spaplus.co');url.pathname+='.rsc';url.searchParams.set('_rsc','KsQaSH2L7Z4e6Q5N');
  const {default:worker}=await workerPromise;
  const r=await worker.fetch(new Request(url,{headers:{Accept:'text/x-component',RSC:'1','X-Vinext-Interception-Context':'/'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(p){p.catch(()=>{});},passThroughOnException(){}});
  assert.equal(r.status,200);const flight=await r.text();
  const imports = [...flight.matchAll(/^[0-9a-f]+:I(\[[^\r\n]+\])$/gm)].map(([, json]) => JSON.parse(json));
  const refs = [...new Set(imports.map(([id]) => id))];
  assert.ok(refs.length>5,'exercise real serialized client references');
  assert.deepEqual(refs.filter(id => !known.has(id)), [], `${version} browser cannot resolve new client modules without a reload: ${path}`);
  for (const [id, , name] of imports) {
    const exports = receipt.retainedShimExports?.[id];
    if (exports) assert.ok(exports.includes(name), `${version} is missing ${name} for ${id}`);
  }
  assert.ok(flight.includes(`/assets/vii-public-${world}-`),'destination stylesheet is carried as a native server resource');
 });
}
