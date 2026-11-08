import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createSourceLoader} from './helpers/source-module-loader.mjs';
const load=createSourceLoader();
const {projectSpaViiSite}=load('app/lib/spa-editorial-policy.ts');
const {spaPlacesFromSites}=load('app/lib/spa-discovery-card.ts');
const {spaItemMatches,spaLandings}=load('app/data/spa-landings.ts');
const {spaItemMatchesSearch,spaSearchStateFromValues,spaSearchHref,spaSearchStateFromSegments,spaSearchTitle}=load('app/data/spa-search-landings.ts');
const catalog=JSON.parse(fs.readFileSync('app/data/spaplus-public-catalog.json','utf8')).sites;
const evidence=JSON.parse(fs.readFileSync('app/data/spaplus-official-facility-evidence.json','utf8')).entries;
const definitions={'indoor-pool':['בריכה פנימית','בריכה מקורה'],'outdoor-pool':['בריכה חיצונית'],'heated-pool':['בריכה מחוממת'],hammam:['חמאם טורקי']};

test('every explicitly recorded SpaPlus facility survives projection and matches its own new filter by supplier identity',async()=>{
 const cards=spaPlacesFromSites(await Promise.all(catalog.map(projectSpaViiSite)));
 for(const [id,labels] of Object.entries(definitions)){
  const landing=spaLandings.find(x=>x.id===id);assert.ok(landing,id);
  const expected=catalog.filter(site=>evidence[site.id]?.labels.some(label=>labels.includes(label))).map(x=>`spa-${x.id}`).sort();
  assert.ok(expected.length>0,id+' has actual source evidence');
  const actual=cards.filter(card=>spaItemMatches(card,landing)).map(x=>x.id).sort();
  for(const supplier of expected)assert.ok(actual.includes(supplier),`${id} dropped ${supplier}`);
  for(const card of cards.filter(card=>spaItemMatches(card,landing)))assert.ok(card.spaFacilityTerms.some(term=>labels.some(label=>term.includes(label))),`${id} narrative-only false positive`);
 }
});

test('new facility filters reject narrative and unrelated facilities, retain canonical URLs and combine with the selected city',()=>{
 for(const [id,labels] of Object.entries(definitions)){
  const landing=spaLandings.find(x=>x.id===id);
  const base={id:'spa-test',world:'spa',name:labels[0],location:'תל אביב',area:'מרכז',description:labels[0],filterText:labels[0],features:[],searchTerms:[labels[0]]};
  assert.equal(spaItemMatches(base,landing),false);
  assert.equal(spaItemMatches({...base,spaFacilityTerms:['סאונה יבשה']},landing),false);
  const factual={...base,spaFacilityTerms:[labels[0]]};assert.equal(spaItemMatches(factual,landing),true);
  const state=spaSearchStateFromValues('תל אביב',undefined,[id]);
  const href=spaSearchHref(state);const roundtrip=spaSearchStateFromSegments(href.split('/').slice(3));
  assert.equal(roundtrip.features[0].id,id);assert.equal(roundtrip.region.slug,'tel-aviv');
  assert.equal(spaItemMatchesSearch(factual,roundtrip),true);
  assert.equal(spaItemMatchesSearch({...factual,location:'אילת',area:'דרום ונגב'},roundtrip),false);
  for(const lang of ['en','fr','ru'])assert.doesNotMatch(spaSearchTitle(state,lang),/[א-ת]|undefined/);
 }
});

test('actual SPA facility control selector exposes every new supported facility',()=>{
 const source=fs.readFileSync('app/components/world-map-results.tsx','utf8');
 const ast=ts.createSourceFile('spa.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let selector;
 const visit=n=>{if(ts.isCallExpression(n)&&n.expression.getText(ast)==='spaFilters.filter'&&n.arguments[0].getText(ast).includes('"hotel"'))selector=n.arguments[0];ts.forEachChild(n,visit);};visit(ast);assert.ok(selector);
 const js=ts.transpileModule('const predicate='+selector.getText(ast)+';',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const predicate=Function(js+';return predicate;')();const visible=spaLandings.filter(predicate).map(x=>x.id);
 for(const id of Object.keys(definitions))assert.ok(visible.includes(id),id+' missing from UI');
});
