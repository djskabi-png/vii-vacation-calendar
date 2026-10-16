import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { readSupplierCatalogSelectedSummaries } from '../app/lib/supplier-catalog-store.ts';

async function route(deps = {}) {
  const source = await readFile(new URL('../app/api/vii/card-galleries/route.ts', import.meta.url),'utf8');
  const compiled = stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm,''),{mode:'strip'}).replace('export async function POST','async function POST');
  const dependencies = { publicCatalogSelectedSummaries:async()=>[], spaPlacesFromSites:sites=>sites, hourlyPlacesFromCatalog:sites=>sites, providerProfiles:[], paidAttractions:[], ...deps };
  return new Function(...Object.keys(dependencies),`${compiled};return POST;`)(...Object.values(dependencies));
}
const request = items => new Request('https://vii.spaplus.co/api/vii/card-galleries',{method:'POST',body:JSON.stringify({items})});

test('library galleries resolve only requested IDs and expose bounded public photos',async()=>{
  const calls=[];
  const post=await route({publicCatalogSelectedSummaries:async(world,ids)=>{
    calls.push([world,ids]);return [{slug:world==='events'?'event-22':'vacation-11',image:'/cover.jpg',images:['/cover.jpg',...Array.from({length:15},(_,i)=>`/${i}.jpg`)],secret:'never-return',reviews:['never-return']}];
  }});
  const response=await post(request([{world:'vacation',id:'vacation-11'},{world:'events',id:'event-22'}]));
  const json=await response.json();
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(calls,[['vacations',[11]],['events',[22]]]);
  assert.equal(json.galleries['vacation:vacation-11'].length,10);
  assert.equal(new Set(json.galleries['events:event-22']).size,10);
  assert.doesNotMatch(JSON.stringify(json),/secret|reviews|never-return/);
});

test('library input rejects malformed, oversize, arbitrary world and excessive page requests before catalog reads',async()=>{
  const post=await route({publicCatalogSelectedSummaries:()=>{throw Error('must not read');}});
  for(const body of ['null','not-json',JSON.stringify({items:[{world:'admin',id:'foo'}]}),JSON.stringify({items:[{world:'spa',id:'../../secret'}]}),JSON.stringify({items:Array(9).fill({world:'spa',id:'spa-1'})}),'x'.repeat(4097)]){
    const response=await post(new Request('https://example.test',{method:'POST',body}));assert.equal(response.status,400,body.slice(0,80));
  }
  const blocked = await post(new Request('https://example.test',{method:'POST',headers:{'Content-Length':'5000'},body:'{}'}));assert.equal(blocked.status,400);
});

test('unknown and missing public cards cannot leak another record; failures remain explicit',async()=>{
  const post=await route();const response=await post(request([{world:'vacation',id:'vacation-99999'}]));
  assert.deepEqual(await response.json(),{galleries:{'vacation:vacation-99999':[]}});
  const fail=await route({publicCatalogSelectedSummaries:async()=>{throw Error('unavailable');}});
  assert.equal((await fail(request([{world:'spa',id:'spa-1'}]))).status,503);
});

test('selected summaries use one generation-pinned bounded query and never load detail JSON',async()=>{
  const queries=[];
  const db={prepare(sql){assert.doesNotMatch(sql,/detail_json/);return{bind(...params){queries.push({sql,params});return{all:async()=>({results:[{activeRunId:'generation1',summaryJson:'{"slug":"vacation-11","images":["/a.jpg"]}'}]})};}};}};
  assert.deepEqual(await readSupplierCatalogSelectedSummaries(db,'vacations',[11,11,12,-1]),[{slug:'vacation-11',images:['/a.jpg']}]);
  assert.equal(queries.length,1);assert.deepEqual(queries[0].params,[11,12,'vacations']);assert.match(queries[0].sql,/e\.run_id = s\.active_run_id/);
  for(const [activeRunId,expected] of [[null,null],['generation1',[]]]){
    const empty={prepare(){return{bind(){return{all:async()=>({results:[{activeRunId,summaryJson:null}]})};}};}};
    assert.deepEqual(await readSupplierCatalogSelectedSummaries(empty,'spa',[1]),expected);
  }
});

test('saved and viewed UI shares gallery without rewriting local history or adding requests elsewhere',async()=>{
  const page=await readFile(new URL('../app/favorites/page.tsx',import.meta.url),'utf8');
  assert.match(page,/visibleItems\.filter/);assert.match(page,/\[galleryRequest\]/);assert.match(page,/controller\.abort\(\)/);
  assert.match(page,/cardGalleries\[item\.key\]/);assert.match(page,/PreviewCardGallery/);
  assert.match(page,/Keep the saved cover and detail link usable on failure/);
  assert.doesNotMatch(page,/writeViewedItems\(/);
});
