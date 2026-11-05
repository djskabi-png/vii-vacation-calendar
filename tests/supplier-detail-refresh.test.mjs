import assert from "node:assert/strict";
import { test } from "node:test";
import { selectDetailRefreshIds, stampDetailRefresh } from "../app/lib/supplier-detail-refresh.ts";

const now = new Date("2026-11-05T12:00:00.000Z");
const entry = (supplierId, meta = {}, detail = {}) => ({ supplierId, summary: { name: `S${supplierId}` }, detail: { ...detail, _viiCatalog: meta } });

test("planner selects never checked and oldest due IDs deterministically", () => {
  assert.deepEqual(selectDetailRefreshIds([entry(2, { checkedAt: "2026-11-01T12:00:00Z" }), entry(1, { checkedAt: "bad" }), entry(3, { checkedAt: "2026-11-04T12:00:00Z" })], [3, 2, 1], 2, now), [1]);
});

test("seven-day freshness, future timestamps and backoff are fail-safe", () => {
  assert.deepEqual(selectDetailRefreshIds([entry(1, { checkedAt: "2026-11-01T12:00:00Z" }), entry(2, { checkedAt: "2026-10-29T11:59:59Z" }), entry(3, { checkedAt: "2027-01-01T00:00:00Z", retryAfter: "2026-11-04T00:00:00Z" }), entry(4, { retryAfter: "2026-11-05T13:00:00Z" })], [1, 2, 3, 4], 10, now), [3, 2]);
  assert.deepEqual(selectDetailRefreshIds([entry(1, { checkedAt: "2026-11-01T12:00:00Z" })], [1], 10, now, { force: true }), [1]);
  assert.deepEqual(selectDetailRefreshIds([entry(1, { retryAfter: "2026-11-05T13:00:00Z" })], [1], 10, now, { force: true }), []);
});

test("stamp is immutable, preserves content, and failed refresh backs off", () => {
  const original = entry(7, { checkedAt: "2026-10-01T00:00:00Z" }, { rooms: [{ id: 2, images: ["x"] }], images: ["cover"] });
  const verified = stampDetailRefresh(original, now, { verified: true });
  assert.notEqual(verified, original); assert.notEqual(verified.detail, original.detail);
  assert.deepEqual(verified.detail.rooms, original.detail.rooms); assert.deepEqual(original.detail._viiCatalog, { checkedAt: "2026-10-01T00:00:00Z" });
  const failed = stampDetailRefresh(original, now, { verified: false });
  assert.equal(failed.detail._viiCatalog.checkedAt, "2026-10-01T00:00:00Z");
  assert.equal(failed.detail._viiCatalog.retryAfter, "2026-11-05T18:00:00.000Z");
});

test("bounded four-per-hour planning covers 547 active IDs over six days without starvation", () => {
  const ids = Array.from({ length: 547 }, (_, index) => index + 1); const selected = new Set();const previous=new Map(ids.map(id=>[id,entry(id)]));
  for (let day = 0; day < 6; day++) for (let hour = 0; hour < 24; hour++) {
    const t = new Date(now.getTime() + day * 86_400_000 + hour * 3_600_000);
    const chosen=selectDetailRefreshIds([...previous.values()],ids,4,t);assert.ok(chosen.length<=4);
    for (const id of chosen){assert.equal(selected.has(id),false,'planner must not revisit a fresh ID even when all active IDs are supplied');selected.add(id);previous.set(id,stampDetailRefresh(previous.get(id),t,{verified:true}));}
  }
  assert.equal(selected.size, 547);
});

test('failed IDs back off without starving the remaining inventory or trusting far-future corrupt metadata',()=>{
 const before=[entry(1),entry(2),entry(3)];before[0]=stampDetailRefresh(before[0],now,{verified:false});assert.deepEqual(selectDetailRefreshIds(before,[1,2,3],2,now),[2,3]);
 assert.deepEqual(selectDetailRefreshIds([entry(1,{retryAfter:'2099-01-01T00:00:00Z'})],[1],4,now),[1]);
 assert.deepEqual(selectDetailRefreshIds(before,[1,2,3],4,new Date(NaN)),[]);assert.deepEqual(selectDetailRefreshIds(before,[1,2,3],Infinity,now),[]);
});
