import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import pages from '../app/data/legacy-event-search-pages.json' with {type:'json'};
import {eventMatchesFeatureSelection,eventFeatureSelectionLabel,eventFeatureTokens} from '../app/lib/event-search-features.ts';

function actualHardFilter(filters){
 const source=readFileSync(new URL('../app/events/search/page.tsx',import.meta.url),'utf8');
 const expression=source.slice(source.indexOf('  const matchesHardFilters ='),source.indexOf('  const filtered = useMemo'));
 const js=ts.transpileModule(expression+'\nexport default matchesHardFilters;', {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};new Function('exports','type','eventType','facility','guests','noNoiseLimit','accessibleOnly','eventMatchesFeatureSelection','matchesVacationSearchFilter',js)(exports,filters.type||'הכל',filters.eventType||'הכל',filters.features||'הכל',0,false,false,eventMatchesFeatureSelection,()=>true);
 return exports.default;
}

test('every approved event attribute is applied by the actual results predicate and cannot fail open',()=>{
 let checked=0;
 for(const page of pages){
  const ids=eventFeatureTokens(page.filters.features||'');
  assert.ok(ids.every(id=>/^amenity-[1-9]\d*$/.test(id)),page.canonicalPath);
  if(!ids.length)continue;
  const predicate=actualHardFilter(page.filters);
  const place={type:page.filters.type||'מתחמי אירועים',eventTypes:[],features:['בריכת שחייה','מיקרוגל','מזגן'],searchFilterIds:ids,guests:50};
  assert.equal(predicate(place),true,page.canonicalPath);
  assert.equal(predicate({...place,searchFilterIds:ids.slice(1)}),false,page.canonicalPath+' must reject missing fact');
  assert.ok(!eventFeatureSelectionLabel(page.filters.features).includes('amenity-'));
  checked++;
 }
 assert.ok(checked>=30);
});

test('unknown and removed structured facts remain excluded; multiple verified facts use AND',()=>{
 const place={features:['בריכת שחייה'],searchFilterIds:['amenity-277']};
 assert.equal(eventMatchesFeatureSelection(place,'amenity-277'),true);
 assert.equal(eventMatchesFeatureSelection(place,'amenity-277,amenity-27'),false);
 assert.equal(eventMatchesFeatureSelection(place,'amenity-999999'),false);
 assert.equal(eventMatchesFeatureSelection({...place,searchFilterIds:[]},'amenity-277'),false);
 assert.equal(eventMatchesFeatureSelection(place,'הכל'),true);
});
