import assert from "node:assert/strict";
import { test } from "node:test";
import { supplierStayQuote } from "../app/lib/vii-stay-quote.ts";

const base = { siteID: 2662, from: "2026-10-15", till: "2026-10-16", guests: 2, token: "test", publishedIds: new Set([2662]) };

function supplier(searchSite, vacancy) {
  const calls = [];
  return { calls, fetchImpl: async (url, init) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
    if(url.includes('/calendar?'))return Response.json({siteID:base.siteID,from:base.from,till:base.till,rooms:[{roomID:4487,dates:[{date:base.from,minNights:1,closedArrival:false,availableUnitCount:1,availableUnits:[1]}]}]});
    return Response.json(url.endsWith("/search") ? { sites: [searchSite] } : {...vacancy,summary:{currency:'ILS',rooms:[{roomID:4487,pax:{adults:base.guests,kids:0,infants:0}}],...vacancy.summary}});
  } };
}

test("exact vacation quote confirms the selected supplier room and total", async () => {
  const { calls, fetchImpl } = supplier({ siteID: 2662, available: true, cheapest: { from: base.from, till: base.till, rooms: [{ roomID: 4487 }] } },
    { available: true, onlineBooking: true, summary: { siteID: 2662, from: base.from, till: base.till, nights: 1, totals: { total: 600 } } });
  assert.deepEqual(await supplierStayQuote({ ...base, fetchImpl }), { status: "available", total: 600, nights: 1, roomIDs: [4487], onlineBooking: true });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, { from: base.from, nights: 1, rooms: [{ adults: 2 }], siteID: 2662 });
  assert.deepEqual(calls[1].body, { siteID: 2662, from: base.from, nights: 1, rooms: [{ roomID: 4487, adults: 2 }] });
});

test("unavailable and malformed supplier responses never become prices", async () => {
  const unavailable = supplier({ siteID: 2662, available: false, reason: "no_prices" }, {});
  assert.deepEqual(await supplierStayQuote({ ...base, fetchImpl: unavailable.fetchImpl }), { status: "unavailable", reason: "no_prices" });
  assert.equal(unavailable.calls.length, 1);
  const wrongTotal = supplier({ siteID: 2662, available: true, cheapest: { from: base.from, till: base.till, rooms: [{ roomID: 4487 }] } },
    { available: true, summary: { siteID: 2662, from: base.from, till: base.till, nights: 1, totals: { total: 0 } } });
  assert.deepEqual(await supplierStayQuote({ ...base, fetchImpl: wrongTotal.fetchImpl }), { status: "unverified", reason: "invalid_supplier_response" });
  const multi = supplier({ siteID: 2662, available: true, cheapest: { from: base.from, till: base.till, rooms: [{ roomID: 1 }, { roomID: 2 }] } }, {});
  assert.deepEqual(await supplierStayQuote({ ...base, fetchImpl: multi.fetchImpl }), { status: "unverified", reason: "multiple_rooms" });
  assert.equal(multi.calls.length, 1);
});

test("unpublished site IDs cannot reach the supplier", async () => {
  await assert.rejects(supplierStayQuote({ ...base, siteID: 999, fetchImpl: async () => { throw Error("called"); } }), /invalid_stay/);
});

test('authoritative vacancy restrictions block invalid stays without a fallback price',async()=>{
 const f=supplier({siteID:base.siteID,available:true,cheapest:{from:base.from,till:base.till,rooms:[{roomID:4487}]}},{available:false,reason:'not_sellable',details:{roomID:4487,reasons:['min_nights']}});
 assert.deepEqual(await supplierStayQuote({...base,fetchImpl:f.fetchImpl}),{status:'unavailable',reason:'min_nights'});
 assert.equal(f.calls.length,2);assert.match(f.calls[1].url,/\/vacancy$/);
});

test('not_sellable reasons remain distinct and never acquire a fallback price',async()=>{
 for(const reason of ['min_nights','closed_to_arrival','no_prices','occupancy']){
  const f=supplier({siteID:base.siteID,available:true,cheapest:{from:base.from,till:base.till,rooms:[{roomID:4487}]}},{available:false,reason:'not_sellable',details:{roomID:4487,reasons:[reason]}});
  assert.deepEqual(await supplierStayQuote({...base,fetchImpl:f.fetchImpl}),{status:'unavailable',reason});
 }
});

test('wrong room, guest composition, currency or date cannot become a dated quote',async()=>{
 for(const mismatch of [{currency:'USD'},{rooms:[{roomID:1,pax:{adults:2}}]},{rooms:[{roomID:4487,pax:{adults:10}}]},{rooms:[{roomID:4487,pax:{adults:2,kids:1}}]},{from:'2026-10-16'}]){
  const f=supplier({siteID:base.siteID,available:true,cheapest:{from:base.from,till:base.till,rooms:[{roomID:4487}]}},{available:true,onlineBooking:true,summary:{siteID:base.siteID,from:base.from,till:base.till,nights:1,totals:{total:600},...mismatch}});
  assert.equal((await supplierStayQuote({...base,fetchImpl:f.fetchImpl})).status,'unverified');
 }
});

test('family quote forwards kids and infants without treating them as adults',async()=>{
 const f=supplier({siteID:base.siteID,available:true,cheapest:{from:base.from,till:base.till,rooms:[{roomID:4487}]}},{available:true,onlineBooking:true,summary:{siteID:base.siteID,from:base.from,till:base.till,nights:1,totals:{total:700},rooms:[{roomID:4487,pax:{adults:2,kids:1,infants:1}}]}});
 const result=await supplierStayQuote({...base,guests:3,rooms:[{adults:2,children:1,infants:1}],fetchImpl:f.fetchImpl});
 assert.equal(result.status,'available');assert.equal(result.total,700);
 assert.deepEqual(f.calls[0].body.rooms,[{adults:2,kids:1,infants:1}]);
 assert.deepEqual(f.calls[1].body.rooms,[{roomID:4487,adults:2,kids:1,infants:1}]);
 await assert.rejects(supplierStayQuote({...base,guests:3,rooms:[{adults:2}],fetchImpl:async()=>{throw Error('must not call')}}),/invalid_stay/);
});

test('a card-provided room goes straight to the authoritative vacancy check',async()=>{
 const f=supplier({}, {available:true,onlineBooking:true,summary:{siteID:base.siteID,from:base.from,till:base.till,nights:1,totals:{total:650}}});
 const result=await supplierStayQuote({...base,roomID:4487,fetchImpl:f.fetchImpl});
 assert.deepEqual(result,{status:'available',total:650,nights:1,roomIDs:[4487],onlineBooking:true});
 assert.equal(f.calls.length,1);assert.match(f.calls[0].url,/\/vacations\/2662\/vacancy$/);
 assert.deepEqual(f.calls[0].body.rooms,[{roomID:4487,adults:2}]);
});
