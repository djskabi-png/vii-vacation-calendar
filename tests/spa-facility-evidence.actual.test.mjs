import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createSourceLoader} from './helpers/source-module-loader.mjs';
const load=createSourceLoader();
const {projectSpaViiSite,projectSpaCatalogEntries}=load('app/lib/spa-editorial-policy.ts');
const {spaPlacesFromSites}=load('app/lib/spa-discovery-card.ts');
const {spaItemMatches,spaLandings}=load('app/data/spa-landings.ts');
const catalog=JSON.parse(fs.readFileSync('app/data/spaplus-public-catalog.json','utf8')).sites;
const evidence=JSON.parse(fs.readFileSync('app/data/spaplus-official-facility-evidence.json','utf8')).entries;
const pool=spaLandings.find(item=>item.id==='pool');
const raw=id=>structuredClone(catalog.find(item=>item.id===id));

test('actual public catalog projection unions partial upstream facts by exact supplier ID',async()=>{
  const original={...raw(6),features:['מקור קיים'],facilityIds:[999]};
  const [entry]=await projectSpaCatalogEntries([{supplierId:6,summary:original,detail:null}]);
  assert.ok(entry.summary.features.includes('מקור קיים'));
  assert.ok(entry.summary.facilityIds.includes(999));
  assert.ok(entry.summary.features.includes('בריכה'));
  const card=spaPlacesFromSites([entry.summary])[0];
  assert.equal(spaItemMatches(card,pool),true);
  assert.equal(card.id,'spa-6');
});
test('Kempinski optional paid pool is searchable without inventing package inclusion',async()=>{
  const projected=await projectSpaViiSite({...raw(385),features:['מקור קיים'],facilityIds:[999]});
  assert.ok(projected.features.includes('מקור קיים'));
  assert.ok(projected.facilityIds.includes(999));
  assert.equal(projected.features.includes('בריכה'),false);
  assert.ok(projected.optionalFeatures.some(item=>item.label==='בריכה'&&item.kind==='optional-paid'));
  assert.deepEqual(projected.packages,raw(385).packages);
  assert.equal(spaItemMatches(spaPlacesFromSites([projected])[0],pool),true);
});
test('an unrelated supplier cannot inherit facilities through a matching title',async()=>{
  const projected=await projectSpaViiSite({...raw(6),id:900001,title:'David Kempinski',features:['מקור קיים'],facilityIds:[999],packages:[]});
  assert.deepEqual(projected.facilityIds,[999]);
  assert.deepEqual(projected.features,['מקור קיים']);
  assert.equal(projected.optionalFeatures,undefined);
});

test('a facility mentioned in excluded package text cannot override structured supplier facts',()=>{
 const card=spaPlacesFromSites([{...raw(6),features:['סאונה יבשה'],optionalFeatures:[],packages:[{id:1,title:'עיסוי ללא בריכה',price:200,people:1}]}])[0];
 assert.equal(spaItemMatches(card,pool),false);
});
test('every reviewed evidence row preserves identity, packages and catalog inventory',async()=>{
  const rows=catalog.filter(site=>evidence[site.id]);
  const projected=await Promise.all(rows.map(projectSpaViiSite));
  assert.equal(projected.length,rows.length);
  for(let i=0;i<rows.length;i++){
    assert.equal(projected[i].id,rows[i].id);
    assert.deepEqual(projected[i].packages,rows[i].packages);
    for(const label of evidence[rows[i].id].labels||[])assert.ok(projected[i].features.includes(label));
  }
});
