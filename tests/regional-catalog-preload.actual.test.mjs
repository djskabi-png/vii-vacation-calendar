import * as catalogHint from '../shared/public-catalog-navigation.ts';
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {withServerRequestReads,readOnceInServerRequest} from '../app/lib/server-request-reads.ts';
import {vacationRegions} from '../app/data/vacation-landings.ts';
import { regionalVacationPreloadPath } from "../app/lib/regional-catalog-preload.ts";

test("regional preload admits only canonical known vacation regions", () => {
  for(const region of vacationRegions)assert.equal(regionalVacationPreloadPath(`/vacations/${region.slug}`,false),`/vacations/${region.slug}`);
  assert.equal(regionalVacationPreloadPath("/en/vacations/north", false), null);
  assert.equal(regionalVacationPreloadPath("/vacations/not-a-region", false), null);
  assert.equal(regionalVacationPreloadPath("/vacations/north?x=1", false), null);
  assert.equal(regionalVacationPreloadPath("/vacations/north", true), null);
});

const nodeRequire=createRequire(import.meta.url);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function loadActual(path,require){
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};new Function('require','module','exports',code)(require,module,module.exports);return module.exports;
}

function harness(path='/vacations/kinneret',requestHeaders={}){
 const stateStarted=deferred(),summaryStarted=deferred(),stateGate=deferred(),rowsGate=deferred(),flagsGate=deferred();
 const calls={state:0,summary:0,overlay:0,imports:0};
 const empty=new Proxy({},{get:()=>()=>undefined});
 const reader=loadActual('app/lib/public-catalog-read.ts',name=>{
  if(name.includes('server-request-reads'))return{readOnceInServerRequest};
  if(name.includes('published-supplier-ids'))return{runtimeCatalogDatabase:async()=>({})};
  if(name.includes('supplier-catalog-store'))return{
   readSupplierCatalogState:async()=>{calls.state++;stateStarted.resolve();await stateGate.promise;return{activeRunId:'accepted-test',activeCount:1};},
   readSupplierCatalogSummaries:async()=>{calls.summary++;summaryStarted.resolve();await rowsGate.promise;return{entries:[{summary:{supplierId:7,slug:'vacation-7',name:'Accepted',description:'Preserved',location:'כנרת',area:'כנרת'}}]};},
  };
  if(name.includes('content-studio'))return{readPublishedItems:async()=>{calls.overlay++;return[];}};
  if(name.includes('public-catalog-policy'))return{publicCatalogEntryAllowed:()=>true};
  if(name.includes('sergey-public-catalog-projection'))return{projectSergeyPublicCatalogValue:v=>v};
  if(name.includes('supplier-display-text'))return{supplierDisplayDescription:v=>v.description};
  if(name.includes('accepted-bundled-catalog'))return{acceptedSergeySummaries:()=>[]};
  return empty;
 });
 const preload=loadActual('app/lib/regional-catalog-preload.ts',name=>{
  if(name.includes('public-catalog-read')){calls.imports++;return reader;}
  throw Error('unexpected_preload_dependency:'+name);
 });
 const worlds=loadActual('app/lib/world-availability.ts',()=>empty);
 const layout=loadActual('app/layout.tsx',name=>{
  if(name==='react/jsx-runtime')return nodeRequire(name);
  if(name==='next/headers')return{headers:async()=>new Headers({'x-vii-pathname':path,'x-vii-locale':'he',...requestHeaders})};
  if(name==='next/navigation')return{redirect:target=>{throw Error('redirect:'+target);}};
  if(name.includes('public-catalog-navigation'))return catalogHint;
  if(name.includes('regional-catalog-preload'))return preload;
  if(name.includes('world-availability')&&!name.includes('provider'))return{readWorldAvailability:()=>flagsGate.promise,worldForPath:worlds.worldForPath};
  if(name.includes('navigation-progress-style'))return{navigationProgressCriticalCss:''};
  return empty;
 });
 return{layout,reader,preload,calls,stateStarted,summaryStarted,stateGate,rowsGate,flagsGate,worlds};
}

test('actual layout probe overlaps accepted catalog work and renders head without waiting for catalog rows',{timeout:3000},async()=>{
 const f=harness();
 await withServerRequestReads(async()=>{
  let layoutDone=false,pageDone=false;
  const root=f.layout.default({children:null}).then(value=>{layoutDone=true;return value;});
  await f.stateStarted.promise;
  assert.equal(layoutDone,false,'catalog starts while world availability is still pending');
  const page=f.reader.publicCatalogSummaries('vacations').then(value=>{pageDone=true;return value;});
  f.stateGate.resolve();await f.summaryStarted.promise;
  assert.equal(f.calls.state,1);assert.equal(f.calls.overlay,1);assert.equal(f.calls.summary,1);
  f.flagsGate.resolve(f.worlds.defaultWorldAvailability);
  assert.equal((await root).type,'html');assert.equal(pageDone,false,'head is not delayed by the speculative catalog read');
  f.rowsGate.resolve();assert.equal((await page)[0].name,'Accepted');
  await f.layout.default({children:null});
  await f.reader.publicCatalogSummaries('vacations');
  assert.equal(f.calls.state,1,'the subsequent actual render and page reuse the request-local read');assert.equal(f.calls.summary,1);
 });
});

test('actual disabled-world layout keeps its redirect and never starts regional catalog work',{timeout:3000},async()=>{
 const f=harness('/events');f.flagsGate.resolve({...f.worlds.defaultWorldAvailability,events:false});
 await withServerRequestReads(async()=>{await assert.rejects(f.layout.default({children:null}),/redirect:\//);});
 assert.equal(f.calls.imports,0);assert.equal(f.calls.state,0);
});

test('actual regional Flight layout never starts the redundant server catalog preload',{timeout:3000},async()=>{
 for(const headers of [{rsc:'1'},{accept:'text/x-component'}]){
  const f=harness('/vacations/kinneret',{...headers,[catalogHint.PUBLIC_CATALOG_NAVIGATION_HEADER]:catalogHint.PUBLIC_CATALOG_NAVIGATION_VERSION});f.flagsGate.resolve(f.worlds.defaultWorldAvailability);
  await withServerRequestReads(async()=>{assert.equal((await f.layout.default({children:null})).type,'html');});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.calls,{state:0,summary:0,overlay:0,imports:0});
 }
});

test('unsupported routes do not even import a catalog reader',async()=>{
 for(const path of ['/admin','/admin/overview','/account','/booking','/business','/events','/spas','/hourly','/vacations/unknown']){
  const f=harness(path);f.preload.preloadRegionalVacationCatalog(path,path.startsWith('/admin'));await Promise.resolve();assert.equal(f.calls.imports,0,path);
 }
});

test('a failed speculative module read cannot produce an unhandled rejection',async()=>{
 let imports=0;
 const preload=loadActual('app/lib/regional-catalog-preload.ts',()=>{imports++;throw Error('synthetic_module_failure');});
 assert.doesNotThrow(()=>preload.preloadRegionalVacationCatalog('/vacations/kinneret',false));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(imports,1);
});


test('ordinary unhinted and refresh Flight keep the original root preload',async()=>{
 for(const headers of [{rsc:'1'},{rsc:'1','X-VII-Catalog-Navigation':'search-v1','X-Vinext-Rsc-Render-Mode':'refresh'},{rsc:'1','X-VII-Catalog-Navigation':'search-v1','Next-Router-Prefetch':'1'}]){
  const f=harness('/vacations/kinneret',headers);
  f.flagsGate.resolve(f.worlds.defaultWorldAvailability);f.stateGate.resolve();f.rowsGate.resolve();
  await withServerRequestReads(async()=>{await f.layout.default({children:null});await f.summaryStarted.promise;});
  assert.equal(f.calls.imports,1);assert.equal(f.calls.summary,1);
 }
});
