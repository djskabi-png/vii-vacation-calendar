import test from "node:test";
import assert from "node:assert/strict";
import { HOME_OFFER_MAX_AGE_MS, isFreshHomeOffer, validHomeOfferResponse } from "../app/lib/home-offer-freshness.ts";

const at = "2026-11-05T10:00:00.000Z";
test("home offer is fresh at 59 minutes and expires at 60", () => {
  const checked = Date.parse(at);
  const value = { cache: { checkedAt: at } };
  assert.equal(isFreshHomeOffer(value, checked + HOME_OFFER_MAX_AGE_MS - 1), true);
  assert.equal(isFreshHomeOffer(value, checked + HOME_OFFER_MAX_AGE_MS), false);
});

test("failed or future-timestamp refresh cannot resurrect an offer", () => {
  const now = Date.parse(at);
  assert.equal(isFreshHomeOffer(null, now), false);
  assert.equal(isFreshHomeOffer({ cache: { checkedAt: new Date(now + 1).toISOString() } }, now), false);
});
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {homeDealDates,homeDealPeriods} from '../app/lib/vii-home-deals.ts';
import {homeOfferCheckedAt} from '../app/lib/home-offer-freshness.ts';
import {acceptedHomeDealsSeed} from "../app/lib/home-deals-seed.ts";
import {discoveryRecoveryDelay} from '../app/lib/discovery-recovery-policy.ts';

const source=readFileSync(new URL('../app/components/home-live-deals.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('home.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let callback;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0]?.getText(ast).includes('const acceptedCandidate')) callback=node.arguments[0].getText(ast);ts.forEachChild(node,visit);}
visit(ast);assert.ok(callback,'execute the real discovery effect');
const compiled=ts.transpileModule(`const effect=${callback};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function harness({seed,previous,loaded,failed=false,now=Date.parse(at)+59*60_000,startedAt}={}){
 const timers=new Map(),requests=[];let timerId=0,data=null,state=null,retries=0;const good=new Map();if(previous)good.set('selection',previous);
 const transport=()=>failed?Promise.reject(new Error('offline')):Promise.resolve(loaded);
 const deps={initialSeedUsable:Boolean(seed),initialHolidaySeedUsable:false,initialData:seed,seedEnabled:Boolean(seed),dealRetry:0,acceptedHomeDealsSeed,active:true,clock:{key:'day',now:new Date(now)},mode:'near',holidayState:'ready',holidayId:null,holidays:[],fixedPeriod:'tomorrow',period:'tomorrow',language:'he',regionLabel:undefined,guests:2,selectionKey:'selection',lastGoodData:{current:good},automaticRetries:{current:new Map()},automaticRecoveryDelays:[1000],displaySettingsApplied:{current:true},setPeriodTabs(){},setPeriod(){},setData:v=>{data=v;},setState:v=>{state=v;},setDealRetry:fn=>{retries=fn(retries);},isFreshHomeOffer,HOME_OFFER_MAX_AGE_MS,homeOfferCheckedAt,homeDealDates,homeDealPeriods,sliderRequestBudgetMs:2_500,primeHomePeriodDeals:(_period,_language,_clock,_guests,_region,waitBudgetMs)=>{requests.push({timeoutMs:waitBudgetMs,totalTimeoutMs:waitBudgetMs,retries:0});return transport();},primeHomeHolidayDeals:()=>transport(),setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
 deps.recoveryStartedAt={current:new Map(startedAt===undefined?[]:[['selection',startedAt]])};deps.selectionRecoveryBudgetMs=10_000;deps.discoveryRecoveryDelay=discoveryRecoveryDelay;deps.validHomeOfferResponse=validHomeOfferResponse;
 const cleanup=new Function(...Object.keys(deps),`${compiled};return effect();`)(...Object.values(deps));
 return{timers,cleanup,good,requests,get data(){return data;},get state(){return state;},get retries(){return retries;}};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
test('actual discovery effect expires a first network snapshot at its source deadline',async()=>{
 const original=Date.now;let now=Date.parse(at)+59*60_000;Date.now=()=>now;
 try{const dates=homeDealDates('tomorrow',new Date(now));const h=harness({loaded:{cache:{checkedAt:at},availabilityStatus:'verified',period:'tomorrow',dates,deals:[]},now});await flush();assert.equal(h.state,'ready');assert.equal(h.good.size,1);const expiry=[...h.timers.values()].find(t=>t.ms===60_000);assert.ok(expiry,'initial API response must arm source expiry');now+=60_000;expiry.fn();assert.equal(h.data,null);assert.equal(h.good.size,0);assert.equal(h.retries,1);h.cleanup();assert.equal(h.timers.size,0);}finally{Date.now=original;}
});
test('actual failure recovery cannot restore an expired last-good snapshot or create a zero-delay loop',async()=>{
 const original=Date.now;let now=Date.parse(at)+HOME_OFFER_MAX_AGE_MS;Date.now=()=>now;
 try{const h=harness({previous:{cache:{checkedAt:at},deals:[{siteID:1}]},failed:true,now});await flush();assert.equal(h.good.size,0);assert.equal(h.data,null);assert.ok([...h.timers.values()].every(t=>t.ms>0));h.cleanup();assert.equal(h.timers.size,0);}finally{Date.now=original;}
});
test('actual source expiry clears accepted fallback after a failed refresh',async()=>{
 const original=Date.now;let now=Date.parse(at)+59*60_000;Date.now=()=>now;
 try{const h=harness({previous:{cache:{checkedAt:at},deals:[]},failed:true,now});await flush();assert.equal(h.state,'ready');const expiry=[...h.timers.values()].find(t=>t.ms===60_000);assert.ok(expiry);now+=60_000;expiry.fn();assert.equal(h.data,null);assert.equal(h.good.size,0);h.cleanup();}finally{Date.now=original;}
});

test('actual transport failure gets one bounded observation retry instead of a false terminal error',async()=>{
 const h=harness({failed:true});await flush();assert.equal(h.state,'loading');assert.equal(h.timers.size,2);const retry=[...h.timers.values()].sort((a,b)=>a.ms-b.ms)[0];assert.ok(retry.ms>0&&retry.ms<10_000);retry.fn();assert.equal(h.retries,1);h.cleanup();
});

test('only explicit pending refresh permits a bounded follow-up poll',async()=>{
 const dates=homeDealDates('tomorrow',new Date(Date.parse(at)+59*60_000));
 const h=harness({loaded:{period:'tomorrow',dates,availabilityStatus:'refreshing',deals:[]}});await flush();assert.equal(h.state,'loading');assert.equal(h.timers.size,2);const retry=[...h.timers.values()].sort((a,b)=>a.ms-b.ms)[0];retry.fn();assert.equal(h.retries,1);h.cleanup();
});

test('selection deadline caps the final request and prevents refresh polling after exhaustion',async()=>{
 const original=Date.now;const now=Date.parse(at)+59*60_000;Date.now=()=>now;
 try{
  const dates=homeDealDates('tomorrow',new Date(now));
  const pending={period:'tomorrow',dates,availabilityStatus:'refreshing',deals:[]};
  const h=harness({loaded:pending,startedAt:now-9_500,now});await flush();assert.equal(h.requests[0].timeoutMs,500);assert.equal(h.requests[0].retries,0);assert.equal(h.requests[0].totalTimeoutMs,500);assert.equal(h.state,'error');assert.equal(h.timers.size,0);h.cleanup();
  const expired=harness({loaded:pending,startedAt:now-10_001,now});await flush();assert.equal(expired.requests.length,0);assert.equal(expired.state,'error');expired.cleanup();
 }finally{Date.now=original;}
});


test('actual fresh seed effect skips only the first fetch and schedules five-minute revalidation',async()=>{
 const original=Date.now;const now=Date.parse(at)+60_000;Date.now=()=>now;
 try {
  const dates=homeDealDates('tomorrow',new Date(now));
  const seed={cache:{status:'fresh',checkedAt:at},availabilityStatus:'verified',period:'tomorrow',locale:'he',guests:2,clockKey:'day',dates,deals:[]};
  const h=harness({seed,now});await flush();assert.equal(h.requests.length,0);assert.equal(h.state,'ready');assert.equal(h.data,seed);
  const revalidate=[...h.timers.values()].find(timer=>timer.ms===4*60_000);assert.ok(revalidate);revalidate.fn();assert.equal(h.retries,1);h.cleanup();assert.equal(h.timers.size,0);
 } finally {Date.now=original;}
});
test('actual stale seed effect remains useful while revalidating and retains its source expiry',async()=>{
 const original=Date.now;const now=Date.parse(at)+59*60_000;Date.now=()=>now;
 try {
  const dates=homeDealDates('tomorrow',new Date(now));
  const seed={cache:{status:'stale',checkedAt:at},availabilityStatus:'verified',period:'tomorrow',locale:'he',guests:2,clockKey:'day',dates,deals:[]};
  const h=harness({seed,now,failed:true});await flush();assert.equal(h.requests.length,1);assert.equal(h.state,'ready');assert.equal(h.data,seed);assert.ok([...h.timers.values()].some(timer=>timer.ms===60_000));h.cleanup();
 } finally {Date.now=original;}
});
