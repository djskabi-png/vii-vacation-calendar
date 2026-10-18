import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {readSupplierCatalogDetails} from '../app/lib/supplier-catalog-store.ts';

const source=readFileSync(new URL('../app/lib/discovery-vacation-catalog.ts',import.meta.url),'utf8');
const compiled=stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm,''),{mode:'strip'}).replace('export function discoveryVacationCatalog','function discoveryVacationCatalog').replace('export type DiscoveryVacationPlace','type DiscoveryVacationPlace');
const load=read=>new Function('publicCatalogDetails',`${compiled};return discoveryVacationCatalog;`)(read);

test('337 public venues use bounded actual D1 room enrichment instead of a 338-parameter query',async()=>{
 const req=createRequire(import.meta.url),dep=createRequire(req.resolve('wrangler')),{Miniflare}=dep('miniflare');
 const mf=new Miniflare({modules:true,script:"export default{fetch(){return new Response('ok')}}",compatibilityDate:'2026-05-15',d1Databases:{DB:'discovery-metadata-bounds'}});
 try{
  const db=await mf.getD1Database('DB');
  await db.prepare('CREATE TABLE supplier_catalog_state(world TEXT PRIMARY KEY,active_run_id TEXT)').run();
  await db.prepare('CREATE TABLE supplier_catalog_entries(run_id TEXT,world TEXT,supplier_id INTEGER,detail_json TEXT)').run();
  await db.prepare("INSERT INTO supplier_catalog_state VALUES ('vacations','current')").run();
  await db.prepare(`WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<337) INSERT INTO supplier_catalog_entries SELECT 'current','vacations',x,json_object('rooms',json_array(json_object('id',x,'name','Suite','bedrooms',2,'guests',6)),'reviews',json_array('DO_NOT_COPY_REVIEW')) FROM n`).run();
  const counts=[];
  const limited={prepare(sql){return{bind(...args){counts.push(args.length);if(args.length>100)throw Error('D1 bound parameters exceed100');return db.prepare(sql).bind(...args);}};}};
  const ids=Array.from({length:337},(_,i)=>i+1);
  await assert.rejects(readSupplierCatalogDetails(limited,'vacations',ids),/exceed100/);
  counts.length=0;
  const helper=load((world,requested)=>readSupplierCatalogDetails(limited,world,requested));
  const catalog=await helper(ids.map(supplierId=>({supplierId,name:`Venue${supplierId}`,images:['https://www.vii.co.il/gallery/real.jpg']})))([...ids,1,999]);
  assert.equal(catalog.size,337);assert.equal(counts.length,11);assert.ok(counts.every(count=>count<=33));
  assert.deepEqual(catalog.get(337).rooms,[{roomID:337,roomName:'Suite',bedrooms:2,maxGuests:6}]);assert.doesNotMatch(JSON.stringify([...catalog]),/DO_NOT_COPY_REVIEW|reviews/);
 }finally{await mf.dispose();}
});

test('empty accepted room detail stays empty and callback failure is not silently fabricated',async()=>{
 const helper=load(async()=>new Map());const values=await helper([{supplierId:1,name:'One',images:[]}])([1]);assert.deepEqual(values.get(1).rooms,[]);
 await assert.rejects(load(async()=>{throw Error('read failed');})([{supplierId:1,name:'One'}])([1]),/read failed/);
});
