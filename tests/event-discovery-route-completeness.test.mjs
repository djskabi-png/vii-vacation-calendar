import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { eventDiscoveryKey, eventDiscoveryValidator, eventOffersForSlot, loadEventDiscovery, EVENT_DISCOVERY_POLICY } from "../app/lib/event-discovery-offers.ts";
import { EVENT_DISCOVERY_VERSION } from "../app/lib/event-discovery-contract.ts";
import { regionalAvailabilityRegion, selectRegionalOffers } from "../app/lib/regional-availability.ts";
import { eligibleDealDate } from "../app/lib/deal-clock.ts";
import { validDate } from "../app/lib/vii-live-search.ts";

const date = "2026-11-05";
const places = Array.from({length:35}, (_, i) => ({ supplierId:i+1, slug:`event-${i+1}`, name:`Venue${i+1}`, image:"/real.jpg", images:[], guests:100, location:"נתניה", area:"מרכז" }));
const raw = places.map(p => ({ siteID:p.supplierId, available:null, reason:"no_prices", days:[{date,
  morning:{freeUnits:1,available:false,roomID:null,price:null}, evening:{freeUnits:0,available:false,roomID:null,price:null} }] }));

function actualHandler(extra) {
  const dependencies = { eventDiscoveryKey, eventDiscoveryValidator, eventOffersForSlot, EVENT_DISCOVERY_POLICY, EVENT_DISCOVERY_VERSION,
    validDate, eligibleDealDate, regionalAvailabilityRegion, selectRegionalOffers,
    Date:class extends Date {constructor(...args){super(...(args.length?args:["2026-11-04T09:00:00Z"]));}},
    supplierToken:async()=>"fixture", publishedSupplierIds:async()=>new Set(places.map(p=>p.supplierId)),
    runtimeCatalogDatabase:async()=>null, publicCatalogSummaries:async()=>places,
    publicCatalogSelectedSummaries:async(_world,ids)=>places.filter(p=>ids.slice(0,20).includes(p.supplierId)),
    ...extra };
  const text = readFileSync(new URL("../app/api/vii/live-search/route.ts",import.meta.url),"utf8");
  const code=stripTypeScriptTypes(text.replace(/^import .*;\r?$/gm,""),{mode:"strip"}).replace("export async function POST","async function POST");
  return new Function(...Object.keys(dependencies),`${code};return POST;`)(...Object.values(dependencies));
}
const request = slot => new Request("https://example.test/api/vii/live-search",{method:"POST",body:JSON.stringify({world:"events",from:date,till:date,guests:20,includePlaces:true,...(slot?{slot}:{})})});

test("actual endpoint retains35 unpriced venues despite the preview-reader cap and projects only selected slot",async()=>{
  let providerCalls=0;
  const snapshot=await loadEventDiscovery({date,guests:20,token:"fixture",publishedIds:new Set(places.map(p=>p.supplierId)),fetchImpl:async()=>{providerCalls++;return Response.json({sites:raw});}});
  const post=actualHandler({readCachedDiscovery:async({key,validate})=>{
    assert.deepEqual(key,eventDiscoveryKey(date,20));assert.equal(validate(snapshot),true);
    return {value:snapshot,cache:{status:"fresh",checkedAt:new Date().toISOString()}};
  }, cachedDiscovery:async()=>{throw new Error("fresh_must_not_recover");}});
  const morning=await post(request("morning"));const body=await morning.json();
  assert.equal(morning.status,200);assert.equal(body.results.length,35);assert.equal(body.places.length,35);
  assert.equal(body.matchedCount,35);assert.deepEqual(body.selectionDiagnostics.missingPublicCardIds,[]);
  assert.ok(body.results.every(r=>r.total===null&&r.roomID===undefined&&r.slot==="morning"));
  assert.equal(Object.hasOwn(body,"eventSlots"),false,"internal snapshot is not redundantly exposed");
  const evening=await (await post(request("evening"))).json();assert.equal(evening.results.length,0);
  assert.equal(providerCalls,1,"both slot projections use the same acquired bulk snapshot");
});

test("stale snapshot invokes one coordinated refresh path, while a cold failure is never retried by the route",async()=>{
  let refreshes=0,loads=0;
  const snapshot=await loadEventDiscovery({date,guests:20,token:"fixture",publishedIds:new Set([1]),fetchImpl:async()=>Response.json({sites:[raw[0]]})});
  const post=actualHandler({readCachedDiscovery:async()=>({value:snapshot,cache:{status:"stale",checkedAt:new Date().toISOString()}}),cachedDiscovery:async()=>{refreshes++;return {value:snapshot,cache:{status:"stale",checkedAt:new Date().toISOString()}};}});
  assert.equal((await post(request())).status,200);assert.equal(refreshes,1);
  const failing=actualHandler({readCachedDiscovery:async()=>{throw new Error("missing");},loadEventDiscovery:async()=>{loads++;throw new Error("supplier_down");},cachedDiscovery:async({load})=>{refreshes++;return load();}});
  assert.equal((await failing(request())).status,503);assert.equal(loads,1);assert.equal(refreshes,2);
});
