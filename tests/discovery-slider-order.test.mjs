import test from "node:test";
import assert from "node:assert/strict";
import { orderDiscoveryRail, orderDiscoveryItems } from "../app/lib/discovery-slider-order.ts";

test("orders the complete pool online first and caps only after ordering", () => {
  const items = Array.from({length: 25}, (_, index) => ({id: index + 1, online: index >= 20, priority: index === 24 ? 1 : 10}));
  const result = orderDiscoveryRail(items, {id: item => item.id, online: item => item.online, priority: item => item.priority, seed: "load-1", limit: 20});
  assert.equal(result.length, 20);
  assert.ok(result.slice(0, 5).every(item => item.online));
  assert.equal(result[0].id, 25);
});

test("same seed is stable while a fresh seed rotates ties", () => {
  const items = Array.from({length: 8}, (_, index) => ({id: index + 1}));
  const a = orderDiscoveryRail(items, {id: item => item.id, seed: "a"});
  assert.deepEqual(orderDiscoveryRail(items, {id: item => item.id, seed: "a"}), a);
  assert.notDeepEqual(orderDiscoveryRail(items, {id: item => item.id, seed: "b"}), a);
});

test("visible cap cannot exceed twenty even if a caller requests more", () => {
 const items=Array.from({length:80},(_,id)=>({id}));
 assert.equal(orderDiscoveryRail(items,{id:x=>x.id,seed:'one',limit:80}).length,20);
 assert.equal(orderDiscoveryRail(items,{id:x=>x.id,seed:'one',limit:-2}).length,0);
 assert.equal(orderDiscoveryRail(items,{id:x=>x.id,seed:'one',limit:NaN}).length,20);
 assert.equal(items.length,80);
 assert.equal(orderDiscoveryItems(items,{id:x=>x.id,seed:'one'}).length,80);
});
