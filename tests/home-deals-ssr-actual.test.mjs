import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {homeDealDates,homeDealPeriods} from '../app/lib/home-deal-dates.ts';
import {dealClockKey,eligibleDealDate} from '../app/lib/deal-clock.ts';
import {acceptedHomeDealsSeed} from '../app/lib/home-deals-seed.ts';
import * as freshness from '../app/lib/home-offer-freshness.ts';
import test from 'node:test';
import assert from 'node:assert/strict';

const compiled=ts.transpileModule(fs.readFileSync('app/components/home-live-deals.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(clock=null) {
 const module={exports:{}};
 const hookModule={exports:{}};
 const hookJs=ts.transpileModule(fs.readFileSync('app/components/use-paced-rail-render.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(hookJs,{module:hookModule,exports:hookModule.exports,require:n=>n==='react'?React:{schedulePacedRailRender:()=>{throw Error('SSR must not schedule');}}});
 const mocks={
 './use-paced-rail-render':hookModule.exports,
 'react':React,'react/jsx-runtime':jsx,'next/link':{default:({children,href})=>React.createElement('a',{href},children)},
 './use-section-activation':{useSectionActivation:()=>true},
 '../lib/vii-home-deals':{homeDealDates,homeDealPeriods},
 '../i18n/locale-provider':{useSiteLanguage:()=>({language:'he',translate:x=>x})},
 '../i18n/locale-routing':{localizedPath:x=>x},
 './home-slider-controls':{HomeSliderControls:()=>null},
 './property-card':{PropertyCard:({property,detailHref,selectedStay})=>React.createElement('a',{'data-test-card':property.slug,href:detailHref},property.name+' '+selectedStay.from)},
 '../lib/regional-availability':{regionalAvailabilityRegion:()=>null},
 '../i18n/regional-availability-copy':{regionalExpansionCopy:{}},
 '../lib/deal-clock':{eligibleDealDate},'../lib/deal-clock.ts':{dealClockKey},
 './use-deal-clock':{useDealClock:()=>clock},
 '../lib/discovery-client-cache.ts':{discoveryJson:()=>{throw Error('SSR must not fetch');}},
 '../lib/home-slider-contract.ts':{capHomeHolidayTabs:x=>x},
 '../lib/verified-slider-offers.ts':{canonicalVerifiedSliderItems:x=>x},
 '../lib/home-period-landings.ts':{permanentHomePeriodLandings:{tomorrow:'/vacations/last-minute'}},
 '../lib/home-offer-freshness.ts':freshness,'../lib/discovery-recovery-policy.ts':{},
 '../lib/home-deals-seed.ts':{acceptedHomeDealsSeed},
 };
 vm.runInNewContext(compiled,{module,exports:module.exports,require:name=>{if(!(name in mocks))throw Error(name);return mocks[name];},Date,URLSearchParams,console});
 return props=>renderToStaticMarkup(React.createElement(module.exports.HomeLiveDeals,props));
}
const now=new Date('2026-11-07T10:00:00Z'), dates=homeDealDates('tomorrow',now);
const seed={availabilityStatus:'verified',period:'tomorrow',guests:2,locale:'he',clockKey:dealClockKey(now),renderedAt:now.toISOString(),dates,cache:{status:'fresh',checkedAt:now.toISOString()},deals:[{siteID:42,name:'SSR real card fixture',image:'/test.jpg',city:'City',area:'Area',priceGuests:2,...dates,total:900,roomID:8,onlineBooking:true}]};
test('actual HomeLiveDeals server render includes card, exact dated business href and no loader',()=>{
 const html=fixture()({initialData:seed});
 assert.match(html,/data-test-card="vacation-42"/);assert.match(html,/SSR real card fixture/);assert.match(html,/roomID=8/);assert.match(html,/guests=2/);assert.doesNotMatch(html,/home-live-deals__loading"/);
});
test('actual render rejects expired, mismatched offer dates, mode and composition',()=>{
 for(const props of [{initialData:{...seed,cache:{checkedAt:'2026-11-07T08:00:00Z'}}},{initialData:{...seed,deals:[{...seed.deals[0],from:'2026-12-01'}]}},{initialData:seed,guests:4},{initialData:seed,mode:'holidays'}]) assert.doesNotMatch(fixture()(props),/data-test-card/);
});
test('actual hydrated clock rejects previous cutoff seed',()=>{
 const next=new Date('2026-11-07T12:01:00Z');
 assert.doesNotMatch(fixture({key:dealClockKey(next),now:next})({initialData:seed}),/data-test-card/);
});

test('streaming fallback preserves rail geometry without interactive controls or network activation',()=>{
 const html=fixture()({pendingSeed:true});assert.match(html,/<section inert="" aria-busy="true"/);assert.match(html,/home-live-deals__loading/);assert.doesNotMatch(html,/data-test-card/);
});

test('mounted clock cannot resurrect an expired seed even while its date snapshot stays stable',()=>{
 const original=Date.now;Date.now=()=>now.getTime()+60*60_000;
 try {assert.doesNotMatch(fixture({key:dealClockKey(now),now})({initialData:seed}),/data-test-card/);} finally {Date.now=original;}
});

test('homepage SSR mounts only the useful first row while retaining all twenty offers for paced activation',()=>{
 const complete={...seed,deals:Array.from({length:20},(_,i)=>({...seed.deals[0],siteID:i+1,name:'Retained card '+i}))};
 const html=fixture()({initialData:complete,deferUntilNearViewport:true});assert.equal((html.match(/data-test-card=/g)||[]).length,4);assert.equal(complete.deals.length,20);
 const standalone=fixture()({initialData:complete,layout:'grid'});assert.equal((standalone.match(/data-test-card=/g)||[]).length,20);
});
