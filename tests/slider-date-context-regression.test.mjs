import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eventDealPresets,currentDealDate} from '../app/lib/event-deal-dates.ts';
import {homeDealDates} from '../app/lib/vii-home-deals.ts';
import {dealClockKey} from '../app/lib/deal-clock.ts';
import {canonicalVerifiedSliderItems} from '../app/lib/verified-slider-offers.ts';

for(const [day,zone] of [['2026-07-08','+03:00'],['2026-11-04','+02:00']]) {
 test(`vacation and event last-minute agree across 14:00 in ${zone}`,()=>{
  for(const [time,expected] of [['00:00:00',day],['13:59:59',day],['14:00:00',day==='2026-07-08'?'2026-07-09':'2026-11-05'],['23:59:59',day==='2026-07-08'?'2026-07-09':'2026-11-05']]){
   const now=new Date(`${day}T${time}${zone}`);
   assert.equal(eventDealPresets(now)[0].date,expected);
   assert.equal(homeDealDates('tomorrow',now).from,expected);
   assert.equal(currentDealDate(now),expected);
  }
  assert.notEqual(dealClockKey(new Date(`${day}T13:59:59${zone}`)),dealClockKey(new Date(`${day}T14:00:00${zone}`)));
 });
}

test('zero and negative slider caps cannot accidentally expose the complete inventory',()=>{
 const offers=Array.from({length:30},(_,siteID)=>({siteID}));
 for(const limit of [0,-1,0.5]) assert.deepEqual(canonicalVerifiedSliderItems(offers,o=>o.siteID,()=>true,limit),[]);
 assert.equal(canonicalVerifiedSliderItems(offers,o=>o.siteID,()=>true,999).length,20);
});

test('dated discovery requests partition HTTP cache on the same clock as component state',()=>{
 for(const file of ['home-live-deals','holiday-live-deals','spa-package-deals']){
  const source=readFileSync(new URL(`../app/components/${file}.tsx`,import.meta.url),'utf8');
  assert.match(source,/clock:\s*clock(?:\.key|Key)/,file);
 }
 const spa=readFileSync(new URL('../app/components/spa-package-deals.tsx',import.meta.url),'utf8');
 assert.match(spa,/const data = result\.key === requestKey \? result\.data : null/);
 assert.match(spa,/availabilityStatus===?"verified"/);
 const home=readFileSync(new URL('../app/components/home-live-deals.tsx',import.meta.url),'utf8');
 assert.match(home,/result\.period !== period/);
});
