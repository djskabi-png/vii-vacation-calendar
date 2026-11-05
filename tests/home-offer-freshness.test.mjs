import test from "node:test";
import assert from "node:assert/strict";
import { HOME_OFFER_MAX_AGE_MS, isFreshHomeOffer } from "../app/lib/home-offer-freshness.ts";

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

const source=readFileSync(new URL('../app/components/home-live-deals.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('home.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let callback;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0]?.getText(ast).includes('const acceptedCandidate')) callback=node.arguments[0].getText(ast);ts.forEachChild(node,visit);}
visit(ast);assert.ok(callback,'execute the real discovery effect');
const compiled=ts.transpileModule(`const effect=${callback};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function harness({previous,loaded,failed=false,now=Date.parse(at)+59*60_000}={}){
 const timers=new Map();let timerId=0,data=null,state=null,retries=0;const good=new Map();if(previous)good.set('selection',previous);
 const deps={clock:{key:'day',now:new Date(now)},mode:'near',holidayState:'ready',holidayId:null,holidays:[],fixedPeriod:'tomorrow',period:'tomorrow',language:'he',regionLabel:undefined,guests:2,selectionKey:'selection',lastGoodData:{current:good},automaticRetries:{current:new Map()},automaticRecoveryDelays:[1000],displaySettingsApplied:{current:true},setPeriodTabs(){},setPeriod(){},setData:v=>{data=v;},setState:v=>{state=v;},setDealRetry:fn=>{retries=fn(retries);},isFreshHomeOffer,HOME_OFFER_MAX_AGE_MS,homeOfferCheckedAt,homeDealDates,homeDealPeriods,discoveryJson:()=>failed?Promise.reject(new Error('offline')):Promise.resolve(loaded),setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
 const cleanup=new Function(...Object.keys(deps),`${compiled};return effect();`)(...Object.values(deps));
 return{timers,cleanup,good,get data(){return data;},get state(){return state;},get retries(){return retries;}};
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
