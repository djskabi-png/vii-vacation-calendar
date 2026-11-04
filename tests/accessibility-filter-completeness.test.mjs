import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { catalogResponse } from '../app/api/catalog/route.ts';
import { buildSergeyAmenityIndex, sergeyAmenitySearchLabels } from '../app/lib/sergey-amenities.ts';
import { createSergeyPublicCatalogClient } from '../app/lib/sergey-public-catalog-client.ts';
import { publicVacationSearchProperties } from '../app/lib/public-vacation-search.ts';
import { matchesVacationSearchFilter, vacationSearchFilterIdsFromText } from '../app/lib/vacation-search-filter-index.ts';
import { hasVerifiedAccessibilityFeature } from '../app/data/accessibility-data.ts';

async function supplierEntries() {
  const ordinary = Array.from({length:30},(_,i)=>({id:100+i,title:`מתקן ${i}`}));
  const definitions=[...ordinary,{id:62,title:'נגישות לנכים'},{id:63,parentID:62,title:'מסלול כניסה מותאם'}];
  const detail=(id)=>({id,active:true,name:`מקום ${id}`,location:{city:1},galleries:[{pictures:['/gallery/photo.jpg']}],
    shared_amenities:id===1?[...ordinary.map(a=>({id:a.id,shown:true})),{id:62,shown:true}]:id===2?[{id:63,shown:false}]:[],
    rooms:[{roomID:id,roomName:'יחידה',roomCount:1,maxGuests:4,amenities:id===3?[{id:62,shown:false}]:[],spaces:[]}]});
  const client=createSergeyPublicCatalogClient({apiKey:'fixture-only',fetchImpl:async(url)=>{
    const p=new URL(url).pathname.replace('/api/ai/vii','');
    if(p==='/locations')return Response.json({cities:[{id:1,title:'טבריה',area:1}],areas:[{id:1,title:'צפון'}]});
    if(p==='/vacations/types')return Response.json({amenities:definitions,roomTypes:[],amenity_categories:[]});
    if(p==='/vacations')return Response.json({places:[1,2,3,4].map(siteID=>({siteID,active:true}))});
    return Response.json(detail(Number(p.split('/').at(-1))));
  }});
  return (await client.fetchCandidate('vacations')).entries;
}

test('every supplier accessibility ID survives full -> compact -> compact pipeline, including hidden parent and secondary unit',async()=>{
  const entries=await supplierEntries();const full=entries.map(e=>e.summary);
  const expected=['vacation-1','vacation-2','vacation-3'];
  const ids=items=>items.filter(p=>matchesVacationSearchFilter(p,'accessible')).map(p=>p.slug);
  assert.deepEqual(ids(full),expected);
  const compact=publicVacationSearchProperties(full);
  assert.deepEqual(ids(compact),expected);
  assert.deepEqual(ids(publicVacationSearchProperties(compact)),expected);
  assert.equal(compact.length,4);assert.ok(compact.every(p=>p.features.length<=3));
  assert.ok(entries[0].detail.features.includes('נגישות לנכים'));
  assert.equal(entries[1].detail.features.includes('מסלול כניסה מותאם'),false);
});

test('recognized normalized filters survive projection even when no display text remains',()=>{
  const p={slug:'vacation-90',name:'מקום',location:'טבריה',area:'צפון',type:'סוויטה',guests:4,image:'/p.jpg',images:['/p.jpg'],description:'',features:[],searchFilterIds:['accessible','pool','wifi','accessible'],audiences:[],badges:[]};
  const [compact]=publicVacationSearchProperties([p]);
  assert.deepEqual(new Set(compact.searchFilterIds),new Set(['accessible','pool','wifi']));
});

test('generic or negative prose cannot manufacture verified accessibility',()=>{
  for(const label of ['מיקום מרכזי נגיש','אינו נגיש לנכים','לא נגיש','בריכה נגישה','נגישות חלקית - לפרטים פנו למארחת']) {
    assert.equal(hasVerifiedAccessibilityFeature([label]),false,label);
    assert.equal(vacationSearchFilterIdsFromText([label]).includes('accessible'),false,label);
  }
  for(const label of ['נגישות לנכים','נגישות מלאה לנכים','נגיש לנכים','מקום נגיש לנכים']) {
    assert.equal(hasVerifiedAccessibilityFeature([label]),true,label);
    assert.equal(vacationSearchFilterIdsFromText([label]).includes('accessible'),true,label);
  }
});


test('actual catalog API preserves all supplier filter identities in both result worlds',async()=>{
  const entries=await supplierEntries();
  for(const world of ['vacations','events']) {
    const rows=entries.map(e=>({supplierId:e.supplierId,summaryJson:JSON.stringify({...e.summary,eventTypes:[],world,slug:`${world==='vacations'?'vacation':'event'}-${e.supplierId}`})}));
    const db={prepare(sql){return {bind(){return this;},async first(){return sql.includes('supplier_catalog_state')?{activeRunId:'fixture-indexed',activeCount:rows.length,acceptedAt:'2026-11-04T00:00:00Z'}:null;},async all(){return {results:sql.includes('supplier_catalog_entries')?rows:[]};}};}};
    const response=await catalogResponse(new Request(`https://vii.spaplus.co/api/catalog?world=${world}&view=search`),db);
    const body=await response.json();assert.equal(body.source,'runtime');assert.equal(response.status,200);
    const matches=body.entries.filter(e=>matchesVacationSearchFilter(e.summary,'accessible')).map(e=>e.supplierId);
    assert.deepEqual(matches,[1,2,3]);assert.equal(body.entries.length,4);
  }
});

test('offline bundle builder computes the same full supplier amenity index before truncation',async()=>{
  const text=await readFile(new URL('../scripts/build-sergey-public-catalog.mjs',import.meta.url),'utf8');
  const tree=ts.createSourceFile('build.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  let expression;
  const walk=node=>{if(ts.isPropertyAssignment(node)&&node.name.getText(tree)==='searchFilterIds')expression=node.initializer.getText(tree);ts.forEachChild(node,walk);};walk(tree);assert.ok(expression,'builder must persist canonical IDs');
  const amenityIndex=buildSergeyAmenityIndex({amenities:[{id:62,title:'נגישות לנכים'},{id:63,parentID:62,title:'כניסה מותאמת'}]});
  const raw={shared_amenities:[{id:63,shown:false}],highlights:[]};
  const run=new Function('vacationSearchFilterIdsFromText','sergeyAmenitySearchLabels','raw','amenityIndex','rooms','name','city','areas','description',`return ${expression}`);
  const result=run(vacationSearchFilterIdsFromText,sergeyAmenitySearchLabels,raw,amenityIndex,[],'מקום',{title:'טבריה',area:1},new Map([[1,'צפון']]),'');
  assert.ok(result.includes('accessible'));
});
