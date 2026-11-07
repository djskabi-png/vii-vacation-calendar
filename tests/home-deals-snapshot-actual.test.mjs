import test from 'node:test';
import assert from 'node:assert/strict';
import {homeDealsPreparation} from './helpers/home-deals-preparation-fixtures.mjs';
import {homeDealDates} from '../app/lib/home-deal-dates.ts';
import {dealClockKey} from '../app/lib/deal-clock.ts';
function fixture({age=0,missing=false}={}){
 const now=new Date(),dates=homeDealDates('weekend',now),primary={id:'editorial'},catalog={id:'catalog'};
 let reads=0,key,curationDb;
 const index={publishedIds:new Set([1,2]),places:[{supplierId:1},{supplierId:2}]};
 const offer={siteID:1,name:'Accepted',from:dates.from,till:dates.till,nights:dates.nights,priceGuests:2,total:1200,roomID:5,onlineBooking:true};
 const source={dates,checkedAt:now.toISOString(),deals:[offer,{...offer,siteID:3},{...offer,siteID:2,priceGuests:4}]};
 const deps={homeDealDates,dealClockKey,VACATION_DISCOVERY_POLICY:{},validVacationDiscoverySnapshot:()=>true,runtimeCatalogDatabase:async()=>catalog,runtimeDatabase:async()=>primary,
 readHomeDisplaySettings:async db=>{assert.equal(db,primary);return{periods:[{id:'weekend',label:'Weekend'}],defaultPeriod:'weekend'};},
 publicDiscoveryCatalogIndex:async()=>index,
 readCachedDiscovery:async options=>{reads++;key=options.key;if(missing)throw Error('missing');return{value:source,cache:{status:'stale',checkedAt:new Date(now.getTime()-age).toISOString()}};},
 curateHomeDeals:async(db,deals)=>{curationDb=db;return deals;}};
 return{...homeDealsPreparation(deps),now,offer,get reads(){return reads},get key(){return key},get curationDb(){return curationDb},primary};
}
test('actual SSR reader uses CMS default, exact cache key, primary editorial DB and same shared published projection',async()=>{
 const f=fixture();const result=await f.readHomeDealsSnapshot({guests:2,locale:'he',now:f.now});
 assert.equal(result.period,'weekend');assert.deepEqual(f.key,['vacation-near',result.dates.from,result.dates.till,2]);assert.equal(f.reads,1);assert.equal(f.curationDb,f.primary);assert.deepEqual(result.deals,[f.offer]);assert.equal(result.renderedAt,f.now.toISOString());assert.equal(result.clockKey,dealClockKey(f.now));
});
test('actual SSR reader rejects snapshots too old for five-minute HTML lifetime and leaves API recovery untouched',async()=>{
 for(const options of [{age:54*60_000},{missing:true}]){const f=fixture(options);assert.equal(await f.readHomeDealsSnapshot({guests:2,locale:'he',now:f.now}),null);assert.equal(f.reads,1);}
});
