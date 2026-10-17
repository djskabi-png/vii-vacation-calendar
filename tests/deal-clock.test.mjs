import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {todayDealsVisible,firstDealDate,eligibleDealDate,dealRailDays,dealClockKey,normalizeDealDate} from '../app/lib/deal-clock.ts';
import {eventDealDate} from '../app/lib/event-deal-dates.ts';
import {homeDealDates} from '../app/lib/vii-home-deals.ts';
import {getHomeHolidays} from '../app/lib/vii-home-holidays.ts';

for(const [day,offset] of [['2026-10-17','+03:00'],['2026-12-17','+02:00'],['2026-03-27','+03:00'],['2026-10-25','+02:00']]) {
  for(const [time,visible] of [['00:00:00',false],['00:00:59',false],['00:01:00',true],['13:59:59',true],['14:00:00',true],['14:00:59',true],['14:01:00',false],['23:59:59',false]]) {
    // Transition-day midnight uses the offset actually in effect at midnight.
    const zone=time.startsWith('00:')&&day==='2026-03-27'?'+02:00':time.startsWith('00:')&&day==='2026-10-25'?'+03:00':offset;
    test(`${day} Israel${time} Today=${visible}`,()=>{
      const now=new Date(`${day}T${time}${zone}`);
      assert.equal(todayDealsVisible(now),visible);
      assert.equal(eventDealDate(0,now),day);
      const days=dealRailDays(6,now);
      assert.equal(days.length,visible?6:5);
      assert.equal(days.includes(day),visible);
      assert.equal(firstDealDate(now),eventDealDate(visible?0:1,now));
      assert.equal(normalizeDealDate('2020-01-01',now),firstDealDate(now));
      assert.ok(days.every(date=>eligibleDealDate(date,now)));
    });
  }
}

test('14:01 hides onlycurrent-day deals; tomorrow/future remains eligible and 00:01 restoresToday',()=>{
 const before=new Date('2026-10-17T14:00:59+03:00'),after=new Date('2026-10-17T14:01:00+03:00');
 assert.notEqual(dealClockKey(before),dealClockKey(after));
 assert.equal(eligibleDealDate('2026-10-17',after),false);
 assert.equal(eligibleDealDate('2026-10-18',after),true);
 assert.equal(normalizeDealDate('2026-10-19',after),'2026-10-19');
 assert.equal(dealRailDays(6,after)[0],'2026-10-18');
 assert.equal(dealRailDays(6,new Date('2026-10-18T00:01:00+03:00'))[0],'2026-10-18');
});

test('vacationweekday period rolls to nextweek aftercutoff withoutremoving futureperiods',()=>{
 const early=new Date('2026-10-15T14:00:59+03:00'),late=new Date('2026-10-15T14:01:00+03:00');
 assert.equal(homeDealDates('thursday',early).from,'2026-10-15');
 assert.equal(homeDealDates('thursday',late).from,'2026-10-22');
 assert.equal(homeDealDates('friday',late).from,'2026-10-16');
 assert.equal(homeDealDates('tomorrow',late).from,'2026-10-16');
});

test('futureholiday isnot hidden; ongoingholiday beginsatfirsteligibleday',async()=>{
 const source={holidays:[{holidayID:1,holidayName:'Ongoing',shown:1,dateStart:'2026-10-16',dateEnd:'2026-10-20'},{holidayID:2,holidayName:'Future',shown:1,dateStart:'2026-12-04',dateEnd:'2026-12-11'}]};
 const get=now=>getHomeHolidays({now:new Date(now),token:'synthetic',fetchImpl:async()=>Response.json(source)});
 assert.equal((await get('2026-10-17T14:00:59+03:00'))[0].from,'2026-10-17');
 const late=await get('2026-10-17T14:01:00+03:00');
 assert.equal(late[0].from,'2026-10-18'); assert.equal(late[1].from,'2026-12-04');
});

function route(path,method,dependencies){
 const source=readFileSync(new URL(`../app/api/${path}/route.ts`,import.meta.url),'utf8');
 const compiled=stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm,''),{mode:'strip'}).replace(`export async function ${method}`,`async function ${method}`);
 return new Function(...Object.keys(dependencies),`${compiled};return ${method};`)(...Object.values(dependencies));
}
const fixed=iso=>class extends Date {constructor(...args){super(...(args.length?args:[iso]));}static now(){return Date.parse(iso);}};

test('actualSPAAPI excludesToday after14:01 andnevercachesboundary-sensitive days',async()=>{
 for(const [time,visible] of [['14:00:59',true],['14:01:00',false],['00:00:59',false],['00:01:00',true]]){
  const GET=route('spa/deals','GET',{Date:fixed(`2026-10-17T${time}+03:00`),dealRailDays,regionalAvailabilityRegion:()=>null,publicCatalogSummaries:async()=>[],readSpaAvailability:async()=>[],selectSpaPackageDeals:()=>[]});
  const response=await GET(new Request('https://example.test/api/spa/deals')); const body=await response.json();
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(body.days.includes('2026-10-17'),visible);assert.equal(Object.hasOwn(body.offers,'2026-10-17'),visible);
 }
});

test('eventrail rejects expiredToday beforeupstream work; normaldatedsearch remainsauthoritative',async()=>{
 let reads=0;
 const POST=route('vii/live-search','POST',{Date:fixed('2026-10-17T14:01:00+03:00'),eligibleDealDate,regionalAvailabilityRegion:()=>null,validDate:()=>true,publishedSupplierIds:async()=>{reads++;return new Set();},supplierToken:async()=>'synthetic',liveSupplierSearch:async()=>({results:[]})});
 const request=includePlaces=>new Request('https://example.test/api/vii/live-search',{method:'POST',body:JSON.stringify({world:'events',from:'2026-10-17',till:'2026-10-17',guests:20,includePlaces})});
 assert.equal((await POST(request(true))).status,400);assert.equal(reads,0);
 assert.equal((await POST(request(false))).status,200);assert.equal(reads,1);
});

test('sharedclock ticks/focus re-evaluatescutoff and00:01, sharesonetimer andcleansup',()=>{
 let now='2026-10-17T14:00:59+03:00',nextId=0;const pending=new Map();const window=new EventTarget(),document=new EventTarget();
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return Date.parse(now);}}
 const raw=readFileSync(new URL('../app/components/use-deal-clock.ts',import.meta.url),'utf8');
 const js=stripTypeScriptTypes(raw.replace(/^import .*;\r?$/gm,'').replace('export function useDealClock','function useDealClock'),{mode:'strip'});
 const load=new Function('Date','window','document','setTimeout','clearTimeout','dealClockKey','useSyncExternalStore',`${js};return useDealClock;`);
 const useClock=load(ClockDate,window,document,fn=>{pending.set(++nextId,fn);return nextId;},id=>pending.delete(id),dealClockKey,(subscribe,getSnapshot,getServerSnapshot)=>({subscribe,getSnapshot,getServerSnapshot}));
 const clock=useClock();assert.equal(clock.getServerSnapshot(),null);let updates=0;const stop=clock.subscribe(()=>updates++),stop2=clock.subscribe(()=>updates++);
 assert.equal(pending.size,1);assert.match(clock.getSnapshot().key,/:today$/);
 now='2026-10-17T14:01:00+03:00';const tick=pending.values().next().value;pending.clear();tick();assert.match(clock.getSnapshot().key,/:future$/);assert.equal(pending.size,1);
 now='2026-10-18T00:00:59+03:00';window.dispatchEvent(new Event('focus'));assert.equal(clock.getSnapshot().key,'2026-10-18:future');
 now='2026-10-18T00:01:00+03:00';document.dispatchEvent(new Event('visibilitychange'));assert.equal(clock.getSnapshot().key,'2026-10-18:today');
 assert.ok(updates>=4);stop();assert.equal(pending.size,1);stop2();assert.equal(pending.size,0);
});

test('SPA labelsfollowactualdates notfilteredindices; allsharedrail clientsuseclock',()=>{
 const spa=readFileSync(new URL('../app/components/spa-package-deals.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(spa,/index===0\?text.today/);assert.match(spa,/day===eventDealDate\(0,clock!\.now\)/);assert.match(spa,/data\?\.days.filter\(day=>eligibleDealDate/);
 for(const name of ['spa-package-deals','home-live-deals','event-last-minute','holiday-live-deals'])assert.match(readFileSync(new URL(`../app/components/${name}.tsx`,import.meta.url),'utf8'),/useDealClock/);
});
