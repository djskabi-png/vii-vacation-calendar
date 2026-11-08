import * as catalogHint from '../shared/public-catalog-navigation.ts';
import * as publicUrl from '../app/lib/public-url.ts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as regions from '../app/data/vacation-landings.ts';
import * as nearby from '../app/lib/nearby-recommendations.ts';
import {publicVacationSearchProperties} from '../app/lib/public-vacation-search.ts';
import {matchesSearchLocation} from '../app/data/search-taxonomy.ts';
import {worldLocationPath} from '../app/lib/world-location-path.ts';

const nativeRequire=createRequire(import.meta.url);
// Execute the actual schema functions. Their unrelated place-offering reader
// is deliberately unavailable, so this route test cannot hide an extra read.
const seoModule={exports:{}};
new Function('require','module','exports',ts.transpileModule(readFileSync('app/lib/seo.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{
  if(name==='./listing-offerings')return{getListingOfferings:()=>{throw Error('unexpected_place_offering_read')}};
  if(name==='./public-url')return publicUrl;
  throw Error('unexpected_schema_dependency:'+name);
},seoModule,seoModule.exports);
const seo=seoModule.exports;
const inventory=regions.vacationRegions.flatMap((region,group)=>Array.from({length:21},(_,i)=>({
  slug:`vacation-${group*100+i+1}`,supplierId:group*100+i+1,name:`Place ${group}/${i}`,
  type:'צימר',types:['צימר'],description:'',location:region.label,area:region.label,
  units:1,guests:i%2?6:2,bedrooms:1,image:'/photo.jpg',images:['/photo.jpg'],
  features:i%2?['בריכה','נגישות לנכים']:[],audiences:[],badges:[],price:i===20?1:1000+i,
})));

function fixture(headerValues={},gate=null){
  const calls={imports:0,reads:0};
  const Seed=()=>null, Search=()=>null, Structured=()=>null, PageShell=({children})=>children, Suspense=({children})=>children, Loading=()=>null;
  const req=name=>{
    if(name.includes('public-catalog-navigation'))return catalogHint;
    if(name==='react/jsx-runtime')return nativeRequire(name);
    if(name==='react')return{Suspense};
    if(name==='next/headers')return{headers:async()=>new Headers(headerValues)};
    if(name==='next/navigation')return{notFound:()=>{throw Error('not_found')}};
    if(name.includes('cached-public-vacation-search')){calls.imports++;return{publicRegionalVacationSearch:async()=>{calls.reads++;if(gate)await gate;return publicVacationSearchProperties(inventory);}};}
    if(name.includes('public-catalog-read')){calls.imports++;return{publicCatalogSummaries:async()=>{calls.reads++;if(gate)await gate;return inventory;}};}
    if(name.includes('public-vacation-search'))return{publicVacationSearchProperties};
    if(name.includes('vacation-landings'))return regions;
    if(name.includes('nearby-recommendations'))return nearby;
    if(name.includes('search-taxonomy'))return{matchesSearchLocation};
    if(name.includes('world-location-path'))return{worldLocationPath};
    if(name.includes('published-catalog-seed'))return{PublishedCatalogSeed:Seed};
    if(name.includes('search/page'))return{SearchExperience:Search};
    if(name.includes('structured-data'))return{StructuredData:Structured};
    if(name.includes('page-shell'))return{PageShell};
    if(name.includes('regional-search-loading'))return{RegionalSearchLoading:Loading};
    if(name.includes('/seo'))return seo;
    throw Error('unexpected_import:'+name);
  };
  const code=ts.transpileModule(readFileSync('app/components/vacation-landing-route.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};new Function('require','module','exports',code)(req,module,module.exports);
  return{...module.exports,calls,Seed,Search,Structured,PageShell,Suspense};
}
function find(tree,type){
  if(Array.isArray(tree)){for(const node of tree){const result=find(node,type);if(result)return result;}return null;}
  if(!tree||typeof tree!=='object')return null;
  return tree.type===type?tree:find(tree.props?.children,type);
}
async function resolveTree(tree){
  if(tree && typeof tree.then==='function') return resolveTree(await tree);
  if(Array.isArray(tree)) return Promise.all(tree.map(resolveTree));
  if(!tree||typeof tree!=='object'||!tree.props) return tree;
  return {...tree,props:{...tree.props,children:await resolveTree(tree.props.children)}};
}

test('actual regional Flight resolves without importing or waiting for any catalog',{timeout:3000},async()=>{
  for(const headers of [{rsc:'1'},{accept:'text/x-component'}]){
    const f=fixture({...headers,[catalogHint.PUBLIC_CATALOG_NAVIGATION_HEADER]:catalogHint.PUBLIC_CATALOG_NAVIGATION_VERSION},new Promise(()=>{}));
    const tree=await f.VacationLandingRoute({regionSlug:'kinneret'});
    const search=find(tree,f.Search);
    assert.equal(f.calls.imports,0);assert.equal(f.calls.reads,0);
    assert.equal(find(tree,f.Seed),null,'no duplicate catalog payload in Flight');
    assert.equal(search.props.landing.area,'כנרת');
    assert.equal(search.props.landing.clientCollectionSchema,true);
    assert.equal(search.key,'/vacations/kinneret');
    assert.ok(find(tree,f.Structured),'breadcrumb metadata remains available');
  }
});

test('all eleven Flight cohorts preserve the rich HTML region selection and editorial content',async()=>{
  for(const region of regions.vacationRegions){
    const html=fixture({accept:'text/html'}),flight=fixture({rsc:'1',[catalogHint.PUBLIC_CATALOG_NAVIGATION_HEADER]:catalogHint.PUBLIC_CATALOG_NAVIGATION_VERSION});
    const rich=await resolveTree(await html.VacationLandingRoute({regionSlug:region.slug}));
    const thin=await flight.VacationLandingRoute({regionSlug:region.slug});
    const seed=find(rich,html.Seed),a=find(rich,html.Search).props.landing,b=find(thin,flight.Search).props.landing;
    assert.equal(html.calls.reads,1);assert.equal(flight.calls.reads,0);
    assert.equal(seed.props.complete,false);
    assert.deepEqual(a.listingSlugs,inventory.filter(place=>matchesSearchLocation(place,b.area)).map(place=>place.slug));
    for(const field of ['path','title','description','breadcrumb','type','area','guideTitle','guideParagraphs','faqs'])assert.deepEqual(b[field],a[field],region.slug+':'+field);
    assert.ok(seed.props.entries.some(place=>place.price===1),'a cheapest candidate beyond the first18 is retained');
  }
});

test('HTML still waits for complete accepted data and emits the full collection schema',{timeout:3000},async()=>{
  let release;const gate=new Promise(resolve=>release=resolve),f=fixture({accept:'text/html'},gate);
  let done=false;const promise=f.VacationLandingRoute({regionSlug:'kinneret'}).then(value=>{done=true;return value;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.calls.reads,1);assert.equal(done,true);
  release();const tree=await resolveTree(await promise),seed=find(tree,f.Seed);
  assert.equal(seed.props.entries.length,21);
  const schemas=[]; (function collect(node){if(Array.isArray(node)) return node.forEach(collect); if(!node||typeof node!=='object') return; if(node.type===f.Structured) schemas.push(node.props.data); collect(node.props?.children);})(tree);
  const list=schemas.flatMap(schema=>schema['@graph']||[]).find(node=>node['@type']==='ItemList');
  assert.equal(list.numberOfItems,21);
  assert.equal((await f.vacationLandingMetadata('kinneret')).alternates.canonical,'/vacations/kinneret');
});

test('city overrides and invalid regions cannot enter the new Flight shortcut',async()=>{
  const city=fixture({rsc:'1'});await city.VacationLandingRoute({regionSlug:'kinneret',locationOverride:'ירושלים'});assert.equal(city.calls.reads,1);
  const missing=fixture({rsc:'1'});await assert.rejects(missing.VacationLandingRoute({regionSlug:'unknown-region'}),/not_found/);assert.equal(missing.calls.imports,0);
});


test('unhinted, unknown-version, prefetch and explicit refresh Flight retain the full server seed',async()=>{
 for(const headers of [{rsc:'1'},{rsc:'1','X-VII-Catalog-Navigation':'future'},{rsc:'1','X-VII-Catalog-Navigation':'search-v1','Next-Router-Prefetch':'1'},{rsc:'1','X-VII-Catalog-Navigation':'search-v1','X-Vinext-Rsc-Render-Mode':'refresh'}]){
  const f=fixture(headers),tree=await f.VacationLandingRoute({regionSlug:'kinneret'});
  assert.equal(f.calls.reads,1);assert.equal(find(tree,f.Seed).props.entries.length,21);
 }
});
