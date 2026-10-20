import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {parseStayCalendar,stayCalendarDay,assessCalendarStay,supplierStayCalendar} from '../app/lib/vii-stay-calendar.ts';

const from='2026-10-23',till='2026-10-28',siteID=2566;
const day=(date,minNights=1,availableUnits=[1],closedArrival=false)=>({date,minNights,availableUnits,availableUnitCount:availableUnits.length,closedArrival});
const raw=()=>({siteID,from,till,rooms:[{roomID:4378,dates:[day('2026-10-23',3),day('2026-10-24',7),day('2026-10-25',0,[1],true),day('2026-10-26'),day('2026-10-27'),day('2026-10-28',0,[],true)]}]});
const parsed=()=>parseStayCalendar(raw(),siteID,from,till);
test('arrival-specific minimum blocks min-1 and allows min, not a weekday constant',()=>{
 const c=parsed(); assert.equal(stayCalendarDay(c,from).minimumNights,3);
 assert.deepEqual(assessCalendarStay(c,from,'2026-10-25'),{allowed:false,reason:'min_nights',minimumNights:3,roomIDs:[]});
 assert.equal(assessCalendarStay(c,from,'2026-10-26').allowed,true);
 assert.equal(assessCalendarStay(c,from,'2026-10-27').allowed,true);
});
test('closures and longer minimum on interior or departure nights do not block the stay',()=>{
 const c=parsed(); assert.equal(assessCalendarStay(c,from,'2026-10-28').allowed,true);
 assert.equal(stayCalendarDay(c,'2026-10-25').arrivalAllowed,false);
 assert.equal(assessCalendarStay(c,'2026-10-25','2026-10-26').reason,'closed_to_arrival');
 const r=raw();r.rooms[0].dates[0].minNights=0;r.rooms[0].dates[0].closedArrival=false;
 assert.equal(assessCalendarStay(parseStayCalendar(r,siteID,from,till),from,'2026-10-26').reason,'closed_to_arrival');
});
test('at least one same physical unit must be free for every occupied night',()=>{
 const r=raw();r.rooms[0].dates[1]=day('2026-10-24',1,[2]);
 assert.equal(assessCalendarStay(parseStayCalendar(r,siteID,from,till),from,'2026-10-26').reason,'not_available');
});
test('unknown nights, partial room coverage and unknown room selection fail closed',()=>{
 const r=raw();r.rooms.push({roomID:4379,dates:[]}); const c=parseStayCalendar(r,siteID,from,till);
 assert.equal(stayCalendarDay(c,from).known,false); assert.equal(stayCalendarDay(c,from).arrivalAllowed,false);
 assert.equal(assessCalendarStay(c,from,'2026-10-26').reason,'calendar_unknown');
 assert.equal(assessCalendarStay(c,from,'2026-10-26',4378).allowed,true);
 assert.equal(assessCalendarStay(c,from,'2026-10-26',9999).reason,'calendar_unknown');
 const missing=raw();missing.rooms[0].dates.splice(1,1);
 assert.equal(assessCalendarStay(parseStayCalendar(missing,siteID,from,till),from,'2026-10-26').reason,'calendar_unknown');
});
test('different room types preserve their own arrival minimum and inventory',()=>{
 const r=raw();r.rooms.push({roomID:4379,dates:r.rooms[0].dates.map(d=>({...d,minNights:2,closedArrival:false,availableUnits:[2],availableUnitCount:1}))});
 const c=parseStayCalendar(r,siteID,from,till);
 assert.equal(stayCalendarDay(c,from).minimumNights,2);
 assert.deepEqual(assessCalendarStay(c,from,'2026-10-25').roomIDs,[4379]);
 assert.equal(assessCalendarStay(c,from,'2026-10-25',4378).reason,'min_nights');
});
test('strict projection rejects malformed, duplicate and cross-context calendar values',()=>{
 for(const mutate of [r=>r.siteID=7,r=>r.from='2026-10-24',r=>r.rooms[0].dates[0].minNights=null,r=>r.rooms[0].dates[0].minNights=-1,r=>r.rooms[0].dates[0].closedArrival='false',r=>r.rooms[0].dates[0].availableUnitCount=2,r=>r.rooms[0].dates.push(r.rooms[0].dates[0]),r=>r.rooms.push(r.rooms[0])]){
  const r=raw();mutate(r);assert.throws(()=>parseStayCalendar(r,siteID,from,till),/invalid_supplier_calendar/);
 }
 const r=raw();r.private='secret';r.rooms[0].private='secret';assert.ok(!JSON.stringify(parseStayCalendar(r,siteID,from,till)).includes('secret'));
});
test('calendar supplier request is bounded, no-store, fixed-origin and unpublished-safe',async()=>{
 const calls=[];const c=await supplierStayCalendar({siteID,from,till,token:'test',publishedIds:new Set([siteID]),fetchImpl:async(url,init)=>{calls.push({url,init});return Response.json(raw());}});
 assert.equal(c.siteID,2566);assert.equal(calls.length,1);assert.match(calls[0].url,/^https:\/\/bizonline.co.il\/api\/ai\/vii\/vacations\/2566\/calendar\?/);assert.equal(calls[0].init.cache,'no-store');assert.equal(calls[0].init.redirect,'error');
 for(const invalid of [{siteID:7},{till:'2027-10-25'},{from:'2026-02-30'}])await assert.rejects(supplierStayCalendar({siteID,from,till,token:'test',publishedIds:new Set([siteID]),...invalid,fetchImpl:async()=>{throw Error('must not call');}}),/invalid_calendar/);
});
test('real calendar plumbing is explicit and authoritative totals survive to checkout',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const business=read('app/business/client-page.tsx'),calendar=read('app/calendar-demo.tsx'),checkout=read('app/booking/client-page.tsx');
 assert.match(business,/calendarRequired=\{Boolean\(supplierSiteID\)\}/);assert.match(business,/liveCalendar=\{supplierCalendar.calendar\}/);
 assert.match(calendar,/illustrative \? minimumNights\(date\) : 1/);assert.match(calendar,/assessCalendarStay\(liveCalendar, checkIn, checkOut\).allowed/);
 assert.match(checkout,/totalPrice: supplierQuote.quote!\.totalPrice!/);assert.match(checkout,/const currentTotal = pricing \? pricing.totalPrice : 0/);
 for(const field of ['rooms','children','infants'])assert.match(checkout,new RegExp(`businessReturnParams.set\\("${field}"`));
});
