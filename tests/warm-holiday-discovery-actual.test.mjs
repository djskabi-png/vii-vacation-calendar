import test from "node:test"; import assert from "node:assert/strict"; import { runHolidayWarmJobs, holidayWarmSelections, holidayDiscoveryKey } from "../app/lib/warm-holiday-discovery-cache.ts";
import { defaultHomeDisplaySettings } from '../app/lib/home-display-settings.ts';
test("holiday warm jobs run max two concurrently and isolate one failure", async () => {
  let active = 0, max = 0; const jobs = Array.from({ length: 18 }, (_, i) => async () => { active++; max = Math.max(max, active); await new Promise(r => setTimeout(r, 2)); active--; if (i === 4) throw new Error("one failure"); return i; });
  const result = await runHolidayWarmJobs(jobs, { limit: 2 });
  assert.equal(max, 2); assert.equal(result.length, 17); assert.ok(!result.includes(4));
});
test("deadline stops admitting new holiday jobs", async () => {
  let now = 0, started = 0; const jobs = Array.from({ length: 18 }, () => async () => { started++; now += 10; return started; });
  const result = await runHolidayWarmJobs(jobs, { limit: 2, deadline: 25, now: () => now });
  assert.ok(started <= 4); assert.equal(result.length, started);
});

test('visible CMS holidays are all prepared for two guests before larger parties; hidden and exact dates are respected', () => {
 const holidays = Array.from({length:8}, (_,i)=>({id:i+1,name:`Holiday ${i}`,from:'2027-02-01',till:'2027-02-10',nights:2,windowSearch:false}));
 const settings = defaultHomeDisplaySettings(); settings.hiddenHolidayIds.add(1); settings.holidayDates.set(2,{from:'2027-02-04',till:'2027-02-06'});
 const selections = holidayWarmSelections(holidays,settings);
 assert.equal(selections.length,18);
 assert.deepEqual(selections.slice(0,6).map(s=>s.guests),[2,2,2,2,2,2]);
 assert.deepEqual(selections.slice(0,6).map(s=>s.holiday.id),[3,4,5,6,7,8]);
 // Exact dates sort according to their actual stay and still participate when visible.
 settings.holidayLimit=8;
 const exact=holidayWarmSelections(holidays,settings).find(s=>s.holiday.id===2);
 assert.equal(exact.requestedFrom,'2027-02-04'); assert.equal(exact.requestedTill,'2027-02-06');
});

test('a fixed future holiday snapshot survives the daily cutoff but never crosses a stay, party or part identity', () => {
 const base={id:139,from:'2027-02-13',till:'2027-02-14',guests:2,part:'all'};
 assert.deepEqual(holidayDiscoveryKey({...base,now:new Date('2026-11-07T11:59:59Z')}),holidayDiscoveryKey({...base,now:new Date('2026-11-07T12:00:00Z')}));
 for(const changed of [{guests:6},{part:'start'},{from:'2027-02-14'},{requestedFrom:'2027-02-13',requestedTill:'2027-02-14'}]) assert.notDeepEqual(holidayDiscoveryKey({...base,...changed}),holidayDiscoveryKey(base));
});
