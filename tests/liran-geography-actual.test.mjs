import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import * as taxonomy from '../app/data/search-taxonomy.ts';
import * as names from '../app/lib/geographic-names.ts';
import * as paths from '../app/lib/world-location-path.ts';
const catalog=JSON.parse(readFileSync(new URL('../app/data/sergey-public-catalog.json',import.meta.url),'utf8'));
const exports={};const source=ts.transpileModule(readFileSync(new URL('../app/data/vacation-landings.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','exports',source)(id=>id.includes('search-taxonomy')?taxonomy:id.includes('geographic-names')?names:id.includes('world-location-path')?paths:{},exports);
test('actual hierarchy keeps Netua city and WesternGalilee with only the property itself present',()=>{
 const property=catalog.places.find(row=>row.location==='נטועה');assert.ok(property);
 for(const inventory of [[property],catalog.places]){
  const trail=exports.vacationBreadcrumbTrailForProperty(property,inventory);
  assert.deepEqual(trail.map(row=>row.name),['ראשי','נופש','נופש בצפון','גליל מערבי','נטועה']);
  assert.deepEqual(exports.vacationBreadcrumbTrail('נטועה',inventory).map(row=>row.name),['ראשי','נופש','נופש בצפון','גליל מערבי','נטועה']);
 }
});
test('an exact region never becomes its own subregion or duplicate breadcrumb',()=>{
 const row=catalog.places.find(row=>row.area==='כנרת');assert.ok(row);
 const region=exports.vacationRegions.find(region=>region.label==='כנרת');
 assert.equal(exports.vacationRegionHierarchy(region,[row]).subregions.length,0);
 const trail=exports.vacationBreadcrumbTrail('כנרת',[row]);assert.deepEqual(trail.map(row=>row.name),['ראשי','נופש','נופש בכנרת']);
});

