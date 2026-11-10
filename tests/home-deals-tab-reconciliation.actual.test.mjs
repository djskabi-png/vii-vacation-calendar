import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import React,{act}from'react';import{createRoot}from'react-dom/client';import{JSDOM}from'jsdom';import{createRequire}from'node:module';
const require=createRequire(import.meta.url);
// Run the complete production component, including its own handlers/effects.
// External services, card rendering and the paced-count input are controlled.
// The actual paced scheduler/hook are covered independently.
const source=fs.readFileSync(process.env.VII_HOME_RAIL_TEST_SOURCE||new URL('../app/components/home-live-deals.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const periods=['tomorrow','weekend','friday-weekend','thursday','friday'].map(id=>({id})),dates={from:'2026-11-12',till:'2026-11-14',nights:2},clock={key:'qa-clock',now:new Date('2026-11-10T09:00:00Z')},weight=()=>0;
const holidays=[1,2].map(id=>({id,name:'Holiday '+id,href:'/holidays/'+id,...dates}));
function offer(period='tomorrow',reverse=false,holiday){return{period,holiday,dates,availabilityStatus:'verified',cache:{status:'fresh',checkedAt:new Date().toISOString()},deals:Array.from({length:20},(_,i)=>({siteID:reverse?20-i:i+1,name:'Place '+(reverse?20-i:i+1),roomName:'Suite',roomID:100+i,priceGuests:2,total:1000,onlineBooking:true,...dates}))};}
async function fixture(props={},language='he'){
 const page=new JSDOM('<div id="root"></div>',{url:'https://vii.test/'}),before=new Map(),requests=[],scrolls=[];
 for(const[k,v]of Object.entries({window:page.window,document:page.window.document,HTMLElement:page.window.HTMLElement,Node:page.window.Node,IS_REACT_ACT_ENVIRONMENT:true})){before.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});}
 page.window.HTMLElement.prototype.scrollTo=function(options){scrolls.push(this);this.scrollLeft=options.left;};
 const state={count:4},fresh=v=>Boolean(v?.availabilityStatus==='verified'&&v?.cache?.checkedAt);
 const modules={
 'next/link':{default:({href,children,...p})=>React.createElement('a',{href,...p},children),__esModule:true},
 './use-paced-rail-render':{usePacedRailRender:(_key,total,_active,enabled)=>enabled?Math.min(state.count,total):total},
 './use-section-activation':{useSectionActivation:()=>true},'../lib/vii-home-deals':{homeDealPeriods:periods,homeDealDates:()=>dates},
 '../i18n/locale-provider':{useSiteLanguage:()=>({language,translate:v=>v})},'../i18n/locale-routing':{localizedPath:href=>href},
 './home-slider-controls':{HomeSliderControls:()=>null},'./property-card':{PropertyCard:({property})=>React.createElement('article',{'data-card':property.slug},property.name)},
 '../lib/regional-availability':{regionalAvailabilityRegion:()=>null,regionalAvailabilityTitle:()=>''},'../i18n/regional-availability-copy':{regionalExpansionCopy:{}},
 '../lib/deal-clock':{eligibleDealDate:()=>true},'./use-deal-clock':{useDealClock:()=>clock},
 '../lib/discovery-client-cache.ts':{discoveryJson:(url,_scope,options)=>url.includes('/home-holidays?')?Promise.resolve({holidays}):new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}))},
 '../lib/home-slider-contract.ts':{capHomeHolidayTabs:v=>v.slice(0,6)},'./use-document-seed':{useDocumentSeed:()=> 'fixed-seed'},'./use-public-promotion-weights':{usePublicPromotionWeights:()=>weight},
 '../lib/discovery-slider-order':{orderDiscoveryItems:v=>v},'../lib/vacation-online-first':{isHomeDealOnlineEligible:()=>true},'../data/search-taxonomy':{matchesSearchLocation:()=>true},
 '../lib/verified-slider-offers.ts':{canonicalVerifiedSliderItems:v=>v},'../lib/home-period-landings.ts':{permanentHomePeriodLandings:Object.fromEntries(periods.map(v=>[v.id,'/period/'+v.id]))},
 '../lib/home-offer-freshness.ts':{HOME_OFFER_MAX_AGE_MS:300_000,homeOfferCheckedAt:v=>Date.parse(v?.cache?.checkedAt||''),isFreshHomeOffer:fresh,validHomeOfferResponse:fresh},
 '../lib/discovery-recovery-policy.ts':{DISCOVERY_RECOVERY_BUDGET_MS:12_000,discoveryRecoveryDelay:()=>null},'../lib/home-deals-seed.ts':{acceptedHomeDealsSeed:(v,c)=>fresh(v)&&v.period===c.period},'../lib/deal-clock.ts':{dealClockKey:()=>clock.key},
 };
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:n=>{if(n==='react'||n==='react/jsx-runtime')return require(n);if(!(n in modules))throw Error('Unstubbed dependency '+n);return modules[n];},URLSearchParams,AbortController,Date,setTimeout,clearTimeout,console});
 const {HomeLiveDeals}=module.exports,root=createRoot(document.getElementById('root')),actualProps={initialData:offer(),deferUntilNearViewport:true,...props};
 const render=()=>root.render(React.createElement(HomeLiveDeals,actualProps));await act(async()=>render());
 return{requests,scrolls,state,rail:()=>document.querySelector('.home-live-deals__track'),tabs:()=>[...document.querySelectorAll('[role=tab]')],async click(i){await act(async()=>this.tabs()[i].click());},async complete(i,v){await act(async()=>requests[i].resolve(v));},async reject(i,e){await act(async()=>requests[i].reject(e));},async count(n){state.count=n;await act(async()=>render());},async close(){await act(async()=>root.unmount());page.window.close();for(const[k,d]of before){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}};
}
for(const language of ['he','en'])test(`actual ${language} rail reserves all snap slots while only card content mounts progressively`,async()=>{
 const h=await fixture({},language);try{const rail=h.rail(),slots=[...rail.children];assert.equal(slots.length,20,'rail extent must be final from first useful row');assert.equal(rail.querySelectorAll('[data-card]').length,4);rail.scrollLeft=language==='he'?-300:300;for(const count of [6,8,20]){await h.count(count);assert.equal(h.rail(),rail);assert.deepEqual([...rail.children],slots);assert.equal(rail.querySelectorAll('[data-card]').length,count);assert.equal(rail.scrollLeft,language==='he'?-300:300);}}finally{await h.close();}
});
test('actual period taps do not scroll old results or reset an active tab; cached revisits start afresh',async()=>{
 const h=await fixture();try{const first=h.rail();first.scrollLeft=-340;await h.click(0);assert.equal(h.rail(),first);assert.equal(first.scrollLeft,-340);assert.equal(h.scrolls.length,0);await h.click(1);assert.equal(h.scrolls.length,0);assert.equal(first.isConnected,false);assert.equal(h.rail(),null);assert.equal(document.querySelector('[role=tabpanel]').getAttribute('aria-busy'),'true');await h.complete(0,offer('weekend',true));const second=h.rail();assert.notEqual(second,first);assert.equal(second.scrollLeft,0);assert.match(second.textContent,/Place 20/);await h.click(0);const third=h.rail();assert.ok(third);assert.notEqual(third,second);assert.equal(third.scrollLeft,0);assert.equal(h.scrolls.length,0);}finally{await h.close();}
});
test('actual rapid selection ignores late old data; external AbortError settles the final loading state',async()=>{
 const h=await fixture();try{await h.click(1);await h.click(2);assert.equal(h.requests[0].options.signal.aborted,true);await h.complete(1,offer('friday-weekend',true));const current=h.rail();assert.ok(current);await h.complete(0,offer('weekend'));assert.equal(h.rail(),current);assert.match(current.textContent,/Place 20/);await h.click(3);await h.reject(2,new DOMException('transport cancelled','AbortError'));assert.equal(document.querySelector('[role=tabpanel]').getAttribute('aria-busy'),'false');assert.match(document.body.textContent,/לא הצלחנו לבדוק/);assert.equal(h.rail(),null);}finally{await h.close();}
});
test('actual holiday selection isolates results and a repeated active holiday preserves its rail',async()=>{
 const h=await fixture({mode:'holidays',initialData:null});try{assert.equal(h.requests.length,1);await h.complete(0,offer(undefined,false,holidays[0]));const first=h.rail();first.scrollLeft=-345;await h.click(0);assert.equal(h.rail(),first);assert.equal(first.scrollLeft,-345);assert.equal(h.scrolls.length,0);await h.click(1);assert.equal(first.isConnected,false);await h.complete(1,offer(undefined,true,holidays[1]));assert.notEqual(h.rail(),first);assert.equal(h.rail().scrollLeft,0);}finally{await h.close();}
});
test('standalone grid still renders every complete card without deferred placeholders',async()=>{
 const h=await fixture({layout:'grid'});try{assert.equal(h.rail().children.length,20);assert.equal(h.rail().querySelectorAll('[data-card]').length,20);assert.equal(h.rail().querySelectorAll('.home-live-deals__deferred-card').length,0);}finally{await h.close();}
});
