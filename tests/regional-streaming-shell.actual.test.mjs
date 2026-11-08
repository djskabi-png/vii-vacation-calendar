import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import React from 'react';
import {renderToReadableStream} from 'react-dom/server';
import ts from 'typescript';
import * as regions from '../app/data/vacation-landings.ts';
import * as nearby from '../app/lib/nearby-recommendations.ts';
import * as hint from '../shared/public-catalog-navigation.ts';
import {matchesSearchLocation} from '../app/data/search-taxonomy.ts';
import {worldLocationPath} from '../app/lib/world-location-path.ts';
import {publicVacationSearchProperties} from '../app/lib/public-vacation-search.ts';

const require=createRequire(import.meta.url);
function load(file,dependencies={}){
 const old=process.env.VII_QA_REGIONAL_SOURCE_REF;
 if(old&&!/^[a-f0-9]{40}$/.test(old))throw Error('invalid baseline ref');
 const source=old&&file==='app/components/vacation-landing-route.tsx'
  ?execFileSync('git',['show',`${old}:${file}`],{encoding:'utf8'}):readFileSync(file,'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',code)(name=>{
  if(name==='react'||name==='react/jsx-runtime')return require(name);
  if(Object.hasOwn(dependencies,name))return dependencies[name];
  throw Error('unexpected import:'+name);
 },module,module.exports);
 return module.exports;
}
const seo=load('app/lib/seo.ts',{'./listing-offerings':{getListingOfferings(){throw Error('unrelated detail read');}}});
const {StructuredData}=load('app/components/structured-data.tsx');
const {RegionalSearchLoading}=load('app/components/regional-search-loading.tsx');
const seed=load('app/lib/published-catalog-seed.tsx');
const header=()=>React.createElement('header',{'data-real-shell':true},'VII navigation');
const footer=()=>React.createElement('footer',null,'VII footer');
const empty=()=>null;
const {PageShell}=load('app/components/page-shell.tsx',{
 './cookie-consent':{CookieConsent:()=>React.createElement('aside',{id:'privacy-settings'},'Privacy choices')},
 './site-footer':{SiteFooter:footer},'../site-header':{SiteHeader:header},
 './global-action-feedback':{GlobalActionFeedback:empty},'./new-tab-navigation':{NewTabNavigation:empty},
 './responsive-viewport-guard':{ResponsiveViewportGuard:empty},'./back-to-top':{BackToTop:empty},
 './smart-navigation-warmup':{SmartNavigationWarmup:empty},'./world-editorial-links':{WorldEditorialLinks:empty},
 './pwa-experience':{PwaExperience:empty},'./localized-skip-link':{LocalizedSkipLink:empty},
 '../lib/world-surface-contract':{worldSurfaceAttributes:()=>({className:'site-page'})},
});
const inventory=publicVacationSearchProperties(Array.from({length:65},(_,index)=>({
 slug:`vacation-${index+1}`,name:`Verified ${index+1}`,location:'כנרת',area:'כנרת',
 type:'צימר',units:1,guests:2,bedrooms:1,image:'/real.jpg',images:['/real.jpg'],
 features:[],audiences:[],badges:[],price:index===64?1:500,description:'',
})));
function Search({landing,embedded=false}){
 const values=seed.usePublishedCatalogSeed('vacations')?.entries??[];
 const body=React.createElement('main',{id:'main-content','data-seeded-count':values.length},
  React.createElement('h1',null,landing.title),...values.map(value=>React.createElement('article',{key:value.slug},value.name)));
 return embedded?body:React.createElement(PageShell,null,body);
}
function fixture(gate){
 let reads=0;
 const mod=load('app/components/vacation-landing-route.tsx',{
  '../../shared/public-catalog-navigation.ts':hint,'next/navigation':{notFound(){throw Error('not_found');}},
  'next/headers':{headers:async()=>new Headers({Accept:'text/html'})},
  '../search/page':{SearchExperience:Search},'../lib/published-catalog-seed':seed,
  './structured-data':{StructuredData},'../lib/seo':seo,
  '../data/vacation-landings':regions,'../lib/nearby-recommendations.ts':nearby,
  '../data/search-taxonomy.ts':{matchesSearchLocation},'../lib/world-location-path.ts':{worldLocationPath},
  './page-shell':{PageShell},'./regional-search-loading':{RegionalSearchLoading},
  '../lib/cached-public-vacation-search.ts':{publicRegionalVacationSearch:async()=>{reads++;await gate;return inventory;}},
 });
 return {...mod,reads:()=>reads};
}

test('actual regional route streams its real shell and heading before a blocked catalog, then preserves every accepted result',{timeout:6000},async()=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 const f=fixture(gate),controller=new AbortController();
 let reader;const decoder=new TextDecoder();let html='';
 async function within(promise,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),1000);})]);}finally{clearTimeout(timer);}}
 try{
  const element=await within(f.VacationLandingRoute({regionSlug:'kinneret'}),'route withheld the entire shell behind catalog');
  const stream=await renderToReadableStream(element,{signal:controller.signal});
  reader=stream.getReader();
  // This read must complete while the canonical catalog remains blocked.
  const first=await within(reader.read(),'shell waited for catalog');
  html+=decoder.decode(first.value,{stream:true});
  assert.match(html,/<header data-real-shell="true">/);
  assert.match(html,/נופש בכנרת/);
  assert.match(html,/regional-search-loading/);
  assert.doesNotMatch(html,/<article|data-seeded-count|"numberOfItems"/);
  assert.equal(f.reads(),1);
  release();
  for(;;){const part=await reader.read();if(part.done)break;html+=decoder.decode(part.value,{stream:true});}
  html+=decoder.decode();
  assert.match(html,/data-seeded-count="65"/);
  assert.match(html,/Verified 65/,'the final cheap candidate is not truncated');
  assert.match(html,/"numberOfItems":65/);
  assert.equal((html.match(/<header /g)||[]).length,1,'one real shell only');
  assert.equal((html.match(/<footer/g)||[]).length,1);
  assert.equal(f.reads(),1);
 }finally{release();controller.abort();await reader?.cancel().catch(()=>{});}
});
