import test from 'node:test';
import assert from 'node:assert/strict';
import spa from '../app/data/spaplus-catalog.json' with {type:'json'};
import {catalogResponse} from '../app/api/catalog/route.ts';
import {spaPlacesFromSites} from '../app/lib/spa-discovery-card.ts';
const request=query=>new Request('https://vii.spaplus.co/api/catalog?'+query);

test('card projection retains every accepted SPA identity, media, price and coordinate without another DB read',async()=>{
  const sites=spa.sites.slice(0,3);let reads=0;
  const db={prepare(sql){reads++;return{bind(){return this;},async first(){return sql.includes('supplier_catalog_state')?{activeRunId:'accepted',activeCount:sites.length,acceptedAt:'2026-11-05T12:00:00Z'}:null;},async all(){return{results:sql.includes('supplier_catalog_entries')?sites.map(site=>({supplierId:site.id,summaryJson:JSON.stringify(site)})):[]};}};}};
  const raw=await catalogResponse(request('world=spa'),db);const baseReads=reads;const source=await raw.json();reads=0;
  const response=await catalogResponse(request('world=spa&view=cards'),db);const body=await response.json();
  assert.equal(body.source,'runtime');assert.equal(reads,baseReads);
  assert.deepEqual(body.entries.map(entry=>entry.summary),spaPlacesFromSites(source.entries.map(entry=>entry.summary)));
  assert.deepEqual(body.entries.map(entry=>entry.supplierId),sites.map(site=>site.id));
  assert.ok(body.entries.every(entry=>entry.summary.world==='spa'&&!Object.hasOwn(entry.summary,'packages')));
  assert.equal(response.headers.get('Cache-Control'),raw.headers.get('Cache-Control'));
});
test('cards are rejected outside the public SPA list before querying the database',async()=>{
  let reads=0;const db={prepare(){reads++;throw Error('unexpected');}};
  for(const query of ['world=vacations&view=cards','world=events&view=cards','world=rooms&view=cards','world=spa&view=cards&id=6'])assert.equal((await catalogResponse(request(query),db)).status,400);
  assert.equal(reads,0);
});
test('fallback card projection keeps the complete accepted snapshot with a smaller payload',async()=>{
  const raw=await catalogResponse(request('world=spa'),null);const full=await raw.text();
  const response=await catalogResponse(request('world=spa&view=cards'),null);const compact=await response.text();const body=JSON.parse(compact);
  assert.equal(body.entries.length,spa.sites.length);
  assert.equal(body.source,'bundled-fallback');assert.ok(compact.length<full.length);
});
