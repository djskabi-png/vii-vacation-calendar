import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createSourceLoader} from './helpers/source-module-loader.mjs';
const load=createSourceLoader();
const {spaItemMatchesSearch,spaSearchStateFromValues,spaSearchHref}=load('app/data/spa-search-landings.ts');
const {spaLandings}=load('app/data/spa-landings.ts');
const {pricedSpaSearchItem,spaPriceQuery}=load('app/lib/spa-search-prices.ts');
const {localizedPath}=load('app/i18n/locale-routing.ts');
const {spaPlacesFromSites}=load('app/lib/spa-discovery-card.ts');
const {projectSpaViiSite}=load('app/lib/spa-editorial-policy.ts');
const source=fs.readFileSync('app/components/world-map-results.tsx','utf8');
const ast=ts.createSourceFile('results.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function find(predicate){let node;function visit(n){if(predicate(n))node=n;ts.forEachChild(n,visit);}visit(ast);assert.ok(node);return node;}
function evaluate(code,ctx,answer){const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function('ctx',`with(ctx){${js};return ${answer};}`)(ctx);}
function fn(name,ctx){const n=find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);return evaluate(n.getText(ast),ctx,name);}
function syncEffect(ctx){const call=find(n=>ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('setPendingFilterId(null)'));return evaluate('const effect='+call.arguments[0].getText(ast),ctx,'effect')();}

test('actual query synchronization restores region audience features and sort on Back and Forward',()=>{
 const values={},ctx={nearby:{defaultSort:'recommended'},initialLocation:'צפון',initialSpaAudience:'single',initialSpaFilters:['sauna'],spaAudiences:{single:{},couple:{},group:{}},spaFilters:spaLandings,sortOptions:[{value:'recommended'},{value:'price-low'}],window:{setTimeout:cb=>{cb();return 1;},clearTimeout(){}},setLocation:v=>values.location=v,setSpaAudience:v=>values.audience=v,setSelectedFilters:v=>values.features=v,setSort:v=>values.sort=v,setPendingFilterId:v=>values.pending=v};
 ctx.searchQuery='location=ירושלים&spaFor=couple&features=pool,jacuzzi&sort=price-low';syncEffect(ctx);
 assert.deepEqual(values,{location:'ירושלים',audience:'couple',features:['pool','jacuzzi'],sort:'price-low',pending:null});
 ctx.searchQuery='';syncEffect(ctx);assert.deepEqual(values,{location:'צפון',audience:'single',features:['sauna'],sort:'recommended',pending:null});
 ctx.initialLocation='דרום';ctx.initialSpaAudience=undefined;ctx.initialSpaFilters=[];syncEffect(ctx);assert.equal(values.location,'דרום');assert.equal(values.audience,'');assert.deepEqual(values.features,[]);
});

test('actual price submit preserves canonical region audience facilities date and sorting',()=>{
 const calls=[],ctx={minimumPrice:'600',maximumPrice:'1000',spaPriceQuery,spaSearchHref,spaSearchStateFromValues,localizedPath,location:'ירושלים',spaAudience:'couple',selectedFilters:['pool'],language:'fr',window:{location:{search:'?date=2026-11-12&sort=price-low&utm_source=fixture'}},router:{push:href=>calls.push(href)},setPriceError:v=>calls.push(v)};
 fn('applyPrice',ctx)({preventDefault(){}});const u=new URL(calls[1],'https://vii.spaplus.co');assert.equal(u.pathname,'/fr/spas/search/jerusalem-city/couples/spa-with-pool');assert.equal(u.searchParams.get('date'),'2026-11-12');assert.equal(u.searchParams.get('sort'),'price-low');assert.equal(u.searchParams.get('minPrice'),'600');assert.equal(u.searchParams.get('maxPrice'),'1000');assert.equal(u.searchParams.get('utm_source'),'fixture');
 calls.length=0;ctx.minimumPrice='1001';fn('applyPrice',ctx)({preventDefault(){}});assert.deepEqual(calls,[true]);
});

test('actual result URL updates preserve budget until an explicit reset',()=>{
 const paths=[],ctx={sort:'price-low',window:{location:{pathname:'/spas/search/north',search:'?minPrice=100&maxPrice=900&date=2026-11-12&sort=price-low'}},spaSearchHref,spaSearchStateFromValues,localizedPath,language:'he',router:{push:p=>paths.push(p)}};
 const update=fn('updateUrl',ctx);update('צפון','couple',['pool']);update('כל הארץ','',[],'recommended',true);
 const first=new URL(paths[0],'https://vii.spaplus.co'),reset=new URL(paths[1],'https://vii.spaplus.co');assert.equal(first.searchParams.get('minPrice'),'100');assert.equal(first.searchParams.get('date'),'2026-11-12');assert.equal(reset.searchParams.has('minPrice'),false);assert.equal(reset.searchParams.has('maxPrice'),false);assert.equal(reset.searchParams.has('sort'),false);assert.equal(reset.searchParams.get('date'),'2026-11-12');
});

test('actual near-me price submit keeps canonical route date audience features and nearest order',()=>{
 const calls=[],ctx={minimumPrice:'300',maximumPrice:'800',spaPriceQuery,spaSearchHref,spaSearchStateFromValues,localizedPath,location:'ירושלים',spaAudience:'couple',selectedFilters:['pool'],language:'fr',window:{location:{pathname:'/fr/spas/near-me',search:'?date=2026-11-19&sort=nearest'}},router:{push:href=>calls.push(href)},setPriceError:v=>calls.push(v)};
 fn('applyPrice',ctx)({preventDefault(){}});const u=new URL(calls[1],'https://vii.spaplus.co');assert.equal(u.pathname,'/fr/spas/near-me');for(const[key,value]of Object.entries({date:'2026-11-19',sort:'nearest',minPrice:'300',maxPrice:'800',spaFor:'couple',features:'pool',location:'ירושלים'}))assert.equal(u.searchParams.get(key),value);
});

test('actual near-me URL updates remain canonical and preserve date budget audience features and explicit sort',()=>{
 const paths=[],ctx={sort:'price-low',window:{location:{pathname:'/spas/near-me',search:'?date=2026-11-19&minPrice=250&maxPrice=900&spaFor=couple&features=pool&sort=price-low'}},spaSearchHref,spaSearchStateFromValues,localizedPath,language:'he',router:{push:p=>paths.push(p)}};
 const update=fn('updateUrl',ctx);update('חיפה','couple',['pool'],'price-low');
 const u=new URL(paths[0],'https://vii.spaplus.co');assert.equal(u.pathname,'/spas/near-me');assert.equal(u.searchParams.get('date'),'2026-11-19');assert.equal(u.searchParams.get('minPrice'),'250');assert.equal(u.searchParams.get('maxPrice'),'900');assert.equal(u.searchParams.get('spaFor'),'couple');assert.equal(u.searchParams.get('features'),'pool');assert.equal(u.searchParams.get('sort'),'price-low');assert.equal(u.searchParams.get('location'),'חיפה');
 update('כל הארץ','',[],'recommended');const reset=new URL(paths[1],'https://vii.spaplus.co');assert.equal(reset.pathname,'/spas/near-me');assert.equal(reset.searchParams.get('date'),'2026-11-19');assert.equal(reset.searchParams.get('minPrice'),'250');assert.equal(reset.searchParams.get('maxPrice'),'900');assert.equal(reset.searchParams.get('sort'),'recommended');
});

test('actual results filter and displayed prices agree with source packages across the entire saved SPA catalog',async()=>{
 const sites=await Promise.all(JSON.parse(fs.readFileSync('app/data/spaplus-public-catalog.json','utf8')).sites.map(projectSpaViiSite));
 const items=spaPlacesFromSites(sites),decl=find(n=>ts.isVariableDeclaration(n)&&n.name.getText(ast)==='amenityFiltered');
 for(const audience of ['single','couple','group','day-pass'])for(const [min,max]of [[0,Infinity],[200,500],[600,1000]]){
  const ctx={items,spaAudience:audience,selectedFilters:[],requestedMinPrice:min,requestedMaxPrice:max,spaItemMatchesSearch,spaSearchStateFromValues,pricedSpaSearchItem,useMemo:cb=>cb()};
  const actual=evaluate('const result='+decl.initializer.getText(ast),ctx,'result');
  const expected=items.filter(item=>spaItemMatchesSearch(item,spaSearchStateFromValues(undefined,audience,[]))).map(item=>pricedSpaSearchItem(item,audience,min,max)).filter(Boolean);
  assert.deepEqual(actual.map(i=>[i.id,i.priceLabel]),expected.map(i=>[i.id,i.priceLabel]));
  for(const card of actual){const prices=card.spaPackagePrices[audience]||[];assert.ok(prices.some(p=>p>=min&&p<=max)||(!Number.isFinite(max)&&min===0&&!card.priceLabel));}
 }
});
