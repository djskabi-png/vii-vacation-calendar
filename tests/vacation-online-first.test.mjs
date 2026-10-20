import test from "node:test";
import assert from "node:assert/strict";
import { prioritizeOnlineFirst, isHomeDealOnlineEligible } from "../app/lib/vacation-online-first.ts";
import { canShowOnlineBookingBadge } from "../app/lib/online-booking-eligibility.ts";
import { readFileSync } from "node:fs";
import { compareVacationPriority, managedVacationPriority } from "../app/lib/vacation-priority.ts";
import { dailyRotationCompare } from "../app/lib/daily-rotation.ts";
import { matchesVacationOnlineBooking } from "../app/lib/vacation-online-booking-filter.ts";

test("online-first is stable inside cohorts", () => {
  const items = [{ id: "a", online: false, rank: 1 }, { id: "b", online: true, rank: 2 }, { id: "c", online: true, rank: 1 }, { id: "d", online: false, rank: 0 }];
  assert.deepEqual(prioritizeOnlineFirst(items, item => item.online, (a, b) => a.rank - b.rank).map(item => item.id), ["c", "b", "d", "a"]);
});

test("unknown, stale and unavailable values never enter online cohort", () => {
  const valid = { ready: true, onlineBooking: true, bookingSupported: true, availability: "available", price: 500, from: "2026-10-20", till: "2026-10-22", selectedFrom: "2026-10-20", selectedTill: "2026-10-22" };
  const items = [{ id: "valid", proof: valid }, { id: "stale", proof: { ...valid, onlineBooking: false } }, { id: "wrong-date", proof: { ...valid, till: "2026-10-23" } }, { id: "unknown", proof: undefined }];
  assert.deepEqual(prioritizeOnlineFirst(items, item => Boolean(item.proof && canShowOnlineBookingBadge(item.proof))).map(item => item.id), ["valid", "stale", "wrong-date", "unknown"]);
});

test("badge proof rejects no price, no room support, illustrative and stale data", () => {
  const base = { ready: true, onlineBooking: true, bookingSupported: true, availability: "available", price: 500, from: "2026-10-20", till: "2026-10-22", selectedFrom: "2026-10-20", selectedTill: "2026-10-22" };
  for (const change of [{ price: 0 }, { bookingSupported: false }, { illustrative: true }, { availability: "unknown" }, { till: "2026-10-19" }]) assert.equal(canShowOnlineBookingBadge({ ...base, ...change }), false);
});

test("home and holiday deals keep accepted online evidence during background refresh", () => {
  const deal = { onlineBooking: true, roomID: 7, total: 1000, nights: 2, from: "2026-10-20", till: "2026-10-22" };
  assert.equal(isHomeDealOnlineEligible(deal), true);
  assert.equal(isHomeDealOnlineEligible({ ...deal, nights: 0 }), false);
  assert.equal(isHomeDealOnlineEligible({ ...deal, roomID: undefined }), false);
  assert.equal(isHomeDealOnlineEligible(deal), true);
});

test("empty and manual order are preserved", () => {
  assert.deepEqual(prioritizeOnlineFirst([], () => true), []);
  assert.deepEqual(prioritizeOnlineFirst([{ id: 1, online: true }, { id: 2, online: false }], item => item.online).map(item => item.id), [1, 2]);
});

test("managed priority beats an uncurated item and rotation breaks equal priority", () => {
  const items = [{ id: "uncurated", online: true }, { id: "managed", curatedRank: 900, online: true }, { id: "managed-2", curatedRank: 900, online: true }, { id: "offline", curatedRank: 1, online: false }];
  for (const day of ["2026-10-19", "2026-10-20"]) {
    const comparator = (a,b)=>compareVacationPriority(a,b,a.id,b.id,"test",day);
    const ordered=prioritizeOnlineFirst(items,item=>item.online,comparator);
    assert.deepEqual(ordered.slice(0,2).map(item=>item.id),["managed","managed-2"].sort((a,b)=>dailyRotationCompare(a,b,"test",day)));
    assert.deepEqual(ordered.slice(2).map(item=>item.id),["uncurated","offline"]);
    assert.deepEqual(prioritizeOnlineFirst([...items].reverse(),item=>item.online,comparator),ordered);
  }
  for (const value of [undefined, "", 0, -1, 1000, 1.5, "NaN", true]) assert.equal(managedVacationPriority(value),undefined);
  assert.equal(managedVacationPriority("900"),900);
});

test("flexible real quote is eligible, while no-date or wrong-date state is not",()=>{
  const quote={availability:"available",onlineBooking:true,bookingSupported:true,nightlyPrice:500,from:"2026-11-02",till:"2026-11-04"};
  const state={status:"ready",quote};
  assert.equal(matchesVacationOnlineBooking(true,state,{from:quote.from,till:quote.till}),true);
  assert.equal(matchesVacationOnlineBooking(true,state,null),false);
  assert.equal(matchesVacationOnlineBooking(true,state,{from:quote.from,till:"2026-11-05"}),false);
  assert.equal(matchesVacationOnlineBooking(true,{...state,status:"loading"},{from:quote.from,till:quote.till}),false);
  const source=readFileSync(new URL("../app/search/page.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(source,/selectedStay && matchesVacationOnlineBooking/);
  const map=source.slice(source.indexOf("const displayedResults = useMemo"),source.indexOf("const resultWindowKey"));
  assert.match(map,/return resultSet.filter/);
  assert.doesNotMatch(map,/\.sort\(/);
});

test("SSR seed and API both project the existing published management priority",()=>{
  const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),"utf8");
  assert.match(read("app/lib/public-catalog-read.ts"),/curatedRank: managedVacationPriority\(content.attributes.homeDealOrder\)/);
  assert.match(read("app/api/catalog/route.ts"),/managedVacationPriority\(item.content.attributes.homeDealOrder\)/);
  assert.match(read("app/lib/public-vacation-search.ts"),/curatedRank: property.curatedRank/);
  for(const file of ["app/search/layout.tsx","app/components/vacation-landing-route.tsx","app/components/accommodation-landing-route.tsx"]) assert.match(read(file),/publicCatalogSummaries/);
  const route=read("app/api/vii/home-deals/route.ts");
  assert.ok(route.indexOf("const ordered = prioritizeOnlineFirst")<route.indexOf("selectRegionalOffers(ordered"));
  assert.match(route,/selected\?\.offers \?\? ordered/);
});

test("all vacation discovery surfaces use the shared online-first comparator", () => {
  for (const file of ["app/search/page.tsx", "app/components/home-live-deals.tsx", "app/components/holiday-live-deals.tsx"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, file.includes("search") ? /prioritizeOnlineFirst/ : /orderDiscovery(?:Rail|Items)\(/);
    assert.match(source, file.includes("search") ? /matchesVacationOnlineBooking/ : /isHomeDealOnlineEligible/);
  }
});
