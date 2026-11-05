import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogPullSlot, scheduledCatalogRunId, scheduledCatalogWorld } from "../app/lib/supplier-catalog-schedule.ts";

test('fixed daily managed jobs use the correct identity within observed early dispatch allowance',()=>{
 for(const [month,offset] of [[1,2],[7,3]])for(const [world,hour,minute]of [['rooms',18,0],['spa',18,30],['events',17,30]]){
  const due=new Date(Date.UTC(2026,month-1,15,hour-offset,minute));
  const expected=catalogPullSlot(due,world);
  assert.equal(catalogPullSlot(new Date(due.getTime()-3*60000),world).id,expected.id);
  assert.equal(catalogPullSlot(new Date(due.getTime()-5*60000),world).id,expected.id);
  assert.notEqual(catalogPullSlot(new Date(due.getTime()-5*60000-1),world)?.id,expected.id);
 }
 assert.equal(catalogPullSlot(new Date('2026-11-05T15:59:00Z'),'vacations').slot,'17:00');
 assert.equal(catalogPullSlot(new Date('2026-11-05T22:59:00Z'),'rooms'),null);
});

test("catalog schedule keeps the approved Israel slots in winter and summer", () => {
  const slots = [
    ["05:00", "vacations"], ["05:30", "events"], ["06:00", "rooms"], ["06:30", "spa"],
    ["12:00", "vacations"], ["12:30", "events"], ["13:00", "rooms"], ["13:30", "spa"],
    ["17:00", "vacations"], ["17:30", "events"], ["18:00", "rooms"], ["18:30", "spa"],
  ];
  for (const [month, offset] of [["01", 2], ["07", 3]]) {
    for (const [time, world] of slots) {
      const [hour, minute] = time.split(":").map(Number);
      const utc = new Date(Date.UTC(2026, Number(month) - 1, 15, hour - offset, minute));
      assert.equal(scheduledCatalogWorld(utc), world, `${month} ${time}`);
      assert.match(scheduledCatalogRunId(utc, world), new RegExp(`^scheduled_2026${month}15_${world}_`));
    }
    assert.equal(scheduledCatalogWorld(new Date(Date.UTC(2026, Number(month) - 1, 15, 7, 0))), null);
  }
  assert.equal(scheduledCatalogWorld(new Date(NaN)), null);
  assert.throws(() => scheduledCatalogRunId(new Date("2026-01-15T07:00:00Z"), "spa"), /catalog_slot_not_due/);
});
