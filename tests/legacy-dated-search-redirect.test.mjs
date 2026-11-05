import assert from "node:assert/strict";
import test from "node:test";
import { legacyDisposition } from "../app/lib/legacy-route-map.ts";
import inventory from "../app/data/legacy-redirect-inventory.json" with {type:"json"};

test('verified current legacy Freedom alias retains exact supplier and booking intent in one hop',()=>{
 const result=legacyDisposition('https://www.vii.co.il/events/Oshiya_Resort?from=2026-11-06&till=2026-11-07&guests=20');
 assert.equal(result.status,301);const target=new URL(result.target,'https://vii.spaplus.co');
 assert.equal(target.pathname,'/events/place/event-2112');assert.equal(target.searchParams.get('from'),'2026-11-06');assert.equal(target.searchParams.get('till'),'2026-11-07');assert.equal(target.searchParams.get('guests'),'20');
 assert.equal(legacyDisposition(target),null,'canonical destination does not redirect again');
});

test("dated legacy search redirects to its approved page and preserves booking state", () => {
  const result = legacyDisposition("https://www.vii.co.il/s?attr=365&marea=2&from=2026-11-06&till=2026-11-07&guests=4");
  assert.deepEqual(result, {
    status: 301,
    target: "/search/vacations/legacy-search-08a7fdff?from=2026-11-06&till=2026-11-07&guests=4",
  });
});

test("undated legacy search keeps the same canonical target", () => {
  assert.deepEqual(legacyDisposition("https://www.vii.co.il/s?attr=365&marea=2"), {
    status: 301,
    target: "/search/vacations/legacy-search-08a7fdff",
  });
});
test("query and numbered legacy search pages preserve the same dated party and sorting intent",()=>{
 const entries=Object.entries(inventory.redirects).filter(([path])=>/^\/s(?:\?|\/)/.test(path)).slice(0,20);assert.ok(entries.length>=10);
 for(const [source,target]of entries){const url=new URL(source,'https://www.vii.co.il');url.searchParams.set('from','2026-11-12');url.searchParams.set('till','2026-11-14');url.searchParams.set('guests','6');url.searchParams.set('rooms','2');url.searchParams.set('sort','price-asc');const disposition=legacyDisposition(url);assert.equal(disposition?.status,301,source);const result=new URL(disposition.target,'https://vii.invalid');const original=new URL(target,'https://vii.invalid');assert.equal(result.pathname,original.pathname,source);for(const key of ['from','till','guests','rooms','sort'])assert.equal(result.searchParams.get(key),url.searchParams.get(key),`${source}: ${key}`);}
 const numbered=legacyDisposition('https://www.vii.co.il/s/11306?from=2026-11-12&till=2026-11-14&guests=6');assert.equal(new URL(numbered.target,'https://vii.invalid').searchParams.get('from'),'2026-11-12');
});
