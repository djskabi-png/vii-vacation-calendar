import assert from 'node:assert/strict';
import test from 'node:test';
import {discoveryExposureScope} from '../app/lib/discovery-exposure-scope.ts';
import {orderDiscoveryRail} from '../app/lib/discovery-slider-order.ts';

test('SPA date/audience changes preserve unrelated homepage rail seeds and complete business order in all locales',()=>{
 const places=Array.from({length:24},(_,i)=>({id:`place-${i}`}));
 const oldQuery=new URLSearchParams('guests=2&spaDealDate=2026-11-09&spaDealFor=single');
 const nextQuery=new URLSearchParams('guests=2&spaDealDate=2026-11-10&spaDealFor=couple');
 for(const path of ['/','/en','/fr/','/ru/']){
  const before=discoveryExposureScope(path,oldQuery),after=discoveryExposureScope(path,nextQuery);
  assert.equal(before,after,path);
  for(const rail of ['vacation','events','hourly']){
   const order=query=>orderDiscoveryRail(places,{id:p=>p.id,seed:`stable-document:${query}:${rail}`}).map(p=>p.id);
   assert.deepEqual(order(before),order(after),`${path}:${rail}`);
  }
 }
});

test('the SPA world still scopes its own date/audience and homepage vacation searches still rotate independently',()=>{
 const single=new URLSearchParams('spaDealDate=2026-11-09&spaDealFor=single');
 const couple=new URLSearchParams('spaDealDate=2026-11-10&spaDealFor=couple');
 for(const path of ['/spas','/spas/today','/en/spas','/fr/spas/search/north'])assert.notEqual(discoveryExposureScope(path,single),discoveryExposureScope(path,couple),path);
 assert.notEqual(discoveryExposureScope('/',new URLSearchParams('guests=2')),discoveryExposureScope('/',new URLSearchParams('guests=6')));
 assert.equal(discoveryExposureScope('/',new URLSearchParams('utm_source=test&sort=priceAsc')),'/?');
});
