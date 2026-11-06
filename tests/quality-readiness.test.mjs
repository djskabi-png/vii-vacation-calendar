import test from "node:test";
import assert from "node:assert/strict";
import { validateEventReadiness, validateVacationReadiness } from "../app/lib/quality-readiness.ts";
import { discoveryReadinessDefinitions, discoveryReadinessProbe } from '../app/lib/quality-readiness.ts';
import { executeQualityCheck,qualityRegistry } from '../app/lib/quality-platform.ts';
import { homeDealDates } from '../app/lib/home-deal-dates.ts';
import { qualityScopeMetadata } from '../app/lib/quality-check-scope.ts';
import { nextDiscoveryClockBoundary,discoveryEvidenceValidUntil,discoveryReceiptCurrent } from '../app/lib/quality-readiness.ts';

const now = Date.parse("2026-11-06T12:00:00Z");
const dates = { from: "2026-11-07", till: "2026-11-09", nights: 2 };
const cache = { checkedAt: "2026-11-06T11:30:00Z" };
test("vacation readiness accepts a verified empty snapshot and rejects refreshing, wrong period, bad price and stale proof", () => {
  const base = { dates, cache, availabilityStatus: "verified", deals: [] };
  assert.deepEqual(validateVacationReadiness(base, dates, 2, now), { ok: true });
  assert.equal(validateVacationReadiness({ ...base, availabilityStatus: "refreshing" }, dates, 2, now).ok, false);
  assert.equal(validateVacationReadiness({ ...base, dates: { ...dates, from: "2026-11-08" } }, dates, 2, now).ok, false);
  assert.equal(validateVacationReadiness({ ...base, deals: [{ priceGuests: 2, total: 0, from: dates.from, till: dates.till }] }, dates, 2, now).ok, false);
  assert.equal(validateVacationReadiness({ ...base, cache: { checkedAt: "2026-11-01T00:00:00Z" } }, dates, 2, now).ok, false);
  assert.equal(validateVacationReadiness({...base,cache:undefined},dates,2,now).ok,false);
  assert.equal(validateVacationReadiness({...base,cache:{checkedAt:'2026-11-06T12:00:01Z'}},dates,2,now).ok,false);
});

test('the same Jerusalem clock drives public and release checks across14:00 and Friday rollover',()=>{
  const before=new Date('2026-11-06T11:59:59Z'),after=new Date('2026-11-06T12:00:00Z');
  assert.equal(homeDealDates('tomorrow',before).from,'2026-11-06');
  assert.equal(homeDealDates('tomorrow',after).from,'2026-11-07');
  const beforeProbe=discoveryReadinessProbe('discovery.vacation.tomorrow.ready',before);
  const payload={period:'tomorrow',dates:homeDealDates('tomorrow',before),availabilityStatus:'verified',cache:{checkedAt:before.toISOString()},deals:[]};
  assert.equal(beforeProbe.validate(payload,before.valueOf()).ok,true);
  assert.equal(discoveryReadinessProbe('discovery.vacation.tomorrow.ready',after).validate(payload,after.valueOf()).ok,false);
  assert.equal(homeDealDates('friday',before).from,'2026-11-06');
  assert.equal(homeDealDates('friday',after).from,'2026-11-13');
  assert.equal(JSON.parse(discoveryReadinessProbe('discovery.events.lastminute.ready',after).body).from,'2026-11-07');
});

test('all eight registry checks execute real semantic verification, with one fixed read-only request each',async()=>{
  assert.equal(discoveryReadinessDefinitions.length,8);
  for(const definition of discoveryReadinessDefinitions){
    assert.ok(qualityScopeMetadata[definition.checkId]);
    const check=qualityRegistry.find(row=>row.checkId===definition.checkId);let calls=0;
    const fetcher=async(url,init)=>{
      calls++;assert.equal(new URL(url).pathname,new URL(definition.route,'https://example.test').pathname);
      const checkedAt=new Date().toISOString();
      if(definition.world==='events'){
        assert.equal(init.method,'POST');const body=JSON.parse(init.body);
        assert.deepEqual(Object.keys(body).sort(),['from','guests','includePlaces','till','world']);
        assert.equal(body.world,'events');assert.equal(body.guests,20);assert.equal(body.from,body.till);assert.equal(body.includePlaces,true);
        return Response.json({world:'events',discoveryVersion:3,scope:{date:body.from,guests:20},cache:{checkedAt},results:[],places:[]});
      }
      assert.equal(init.method,'GET');assert.equal(init.body,undefined);
      return Response.json({period:definition.period,dates:homeDealDates(definition.period),availabilityStatus:'verified',cache:{checkedAt},deals:[]});
    };
    const result=await executeQualityCheck(check,'https://example.test',fetcher);
    assert.equal(result.status,'passed',definition.checkId);
    assert.ok(Date.parse(result.evidenceValidUntil)>Date.now());
    assert.equal(calls,1);
    assert.equal((await executeQualityCheck(check,'https://example.test',async()=>Response.json({availabilityStatus:'refreshing',deals:[]}))).status,'failed');
  }
});

test('receipt proof expires at snapshot TTL or the exact Israel clock rollover, including DST weekends',()=>{
  for(const [start,boundary] of [
    ['2026-11-06T11:59:59Z','2026-11-06T12:00:00Z'],
    ['2026-11-06T21:59:59Z','2026-11-06T22:00:00Z'],
    ['2026-03-27T00:00:00Z','2026-03-27T11:00:00Z'],
    ['2026-10-25T00:00:00Z','2026-10-25T12:00:00Z'],
  ])assert.equal(new Date(nextDiscoveryClockBoundary(Date.parse(start))).toISOString(),new Date(boundary).toISOString());
  const checked=Date.parse('2026-11-06T11:59:30Z');
  const evidenceValidUntil=discoveryEvidenceValidUntil({cache:{checkedAt:new Date(checked).toISOString()}},checked);
  assert.equal(evidenceValidUntil,'2026-11-06T12:00:00.000Z');
  const receipt={checkedAt:new Date(checked).toISOString(),evidenceValidUntil};
  assert.equal(discoveryReceiptCurrent(receipt,Date.parse('2026-11-06T11:59:59.999Z')),true);
  assert.equal(discoveryReceiptCurrent(receipt,Date.parse(evidenceValidUntil)),false);
  assert.equal(discoveryReceiptCurrent({...receipt,evidenceValidUntil:'2026-11-06T13:00:00.000Z'},checked),false,'an extended expiry cannot cross the clock window');
  assert.equal(discoveryReceiptCurrent({checkedAt:receipt.checkedAt},checked),false);
  const earlier=Date.parse('2026-11-06T08:00:00Z');
  assert.equal(discoveryEvidenceValidUntil({cache:{checkedAt:new Date(earlier).toISOString()}},earlier+30*60_000),'2026-11-06T09:00:00.000Z');
});

test('a forged readiness route cannot turn the quality executor into a generic POST facility',async()=>{
  const check=qualityRegistry.find(row=>row.checkId==='discovery.events.lastminute.ready');let calls=0;
  for(const changed of [{...check,route:'/api/vii/booking'},{...check,semanticContract:undefined},{...check,semanticContract:'discovery-readiness-v1'},{...check,checkId:'attacker.post'}]){
    const result=await executeQualityCheck(changed,'https://example.test',async()=>{calls++;return Response.json({});});
    assert.equal(result.status,'blocked');
  }
  assert.equal(calls,0);
});

test('event readiness rejects partial joins, wrong version, guests, date and invalid offer price',()=>{
  const scope={date:'2026-11-07',guests:20};
  const offer={siteID:7,from:scope.date,till:scope.date,priceGuests:20,available:true,slot:'evening',total:null};
  const value={world:'events',discoveryVersion:3,scope,cache,results:[offer],places:[{slug:'event-7'}]};
  assert.equal(validateEventReadiness(value,scope,now).ok,true,'confirmed contact-only availability is legitimate');
  for(const changed of [{...value,discoveryVersion:undefined},{...value,cache:undefined},{...value,places:[]},{...value,places:[{slug:'event-8'}]},{...value,scope:{...scope,guests:2}},{...value,results:[{...offer,total:0}]},{...value,results:[{...offer,from:'2026-11-08'}]},{...value,results:[{...offer,till:'2026-11-09'}]},{...value,results:[{...offer,till:'2026-11-06'}]},{...value,results:[{...offer,till:undefined}]}])assert.equal(validateEventReadiness(changed,scope,now).ok,false);
});
test('event readiness accepts the supplier overnight calendar date but rejects longer or missing dates',()=>{
  const scope={date:'2026-11-07',guests:20};
  const base={world:'events',discoveryVersion:3,scope,cache,results:[{siteID:8,from:scope.date,till:'2026-11-08',priceGuests:20,available:true,slot:'morning',total:1200}],places:[{slug:'event-8'}]};
  assert.deepEqual(validateEventReadiness(base,scope,now),{ok:true});
  assert.deepEqual(validateEventReadiness({...base,results:[{...base.results[0],till:scope.date}]},scope,now),{ok:true});
  for(const till of ['2026-11-09','2026-11-06','2026-02-30',undefined]) assert.equal(validateEventReadiness({...base,results:[{...base.results[0],till}]},scope,now).ok,false,till);
});
test("event readiness requires exact date and guests with fresh proof", () => {
  const value = { discoveryVersion: 3, world: "events", scope: { date: "2026-11-07", guests: 20 }, cache, results: [], places: [] };
  assert.deepEqual(validateEventReadiness(value, { date: "2026-11-07", guests: 20 }, now), { ok: true });
  assert.equal(validateEventReadiness({ ...value, scope: { date: "2026-11-08", guests: 20 } }, { date: "2026-11-07", guests: 20 }, now).ok, false);
  assert.equal(validateEventReadiness({ ...value, availabilityStatus: "refreshing" }, { date: "2026-11-07", guests: 20 }, now).ok, false);
});
