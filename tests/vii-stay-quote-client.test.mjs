import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=readFileSync(new URL('../app/components/use-vii-stay-quote.ts',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'').replace(/^"use client";/,'');
const compiled=stripTypeScriptTypes(source,{mode:'strip'}).replace('export function useViiStayQuote','function useViiStayQuote');
const good={status:'available',total:17500,nights:3,roomIDs:[4378],onlineBooking:true,minimumNights:3};
const flush=async()=>{for(let n=0;n<20;n++)await Promise.resolve();};
function harness(fetch){
 let states=[],cursor=0,effect;
 const hook=new Function('useState','useEffect','useCallback','fetch',`${compiled};return useViiStayQuote;`)(initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v}]},cb=>{effect=cb},cb=>cb,fetch);
 return {render(rooms){cursor=0;return hook(2566,'2026-10-23','2026-10-26',3,rooms)},effect:()=>effect(),states:()=>states};
}
test('authoritative stay total survives a repeating nightly average',async()=>{
 const h=harness(async()=>Response.json(good));h.render();h.effect();await flush();const value=h.render();
 assert.equal(value.quote.totalPrice,17500);assert.equal(value.quote.nightlyPrice,17500/3);assert.equal(value.quote.priceMode,'nightly_average');
});
test('an aborted old response cannot overwrite a newer quote, even if its fetch ignores abort',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>{resolve=r}));h.render();const cancel=h.effect();cancel();resolve(Response.json(good));await flush();assert.equal(h.states()[0],null);
});
test('invalid prices, mismatched nights and missing rooms clear online readiness',async()=>{
 for(const bad of [{...good,total:0},{...good,nights:2},{...good,roomIDs:[]},{...good,roomIDs:[0]},{status:'mystery'}]){
  const h=harness(async()=>Response.json(bad));h.render();h.effect();await flush();const value=h.render();assert.equal(value.quote,null);assert.equal(value.onlineBooking,false);assert.equal(value.status,'error');
 }
});
test('same total guest count with different ages is a different quote identity',async()=>{
 const h=harness(async()=>Response.json(good));const family=[{adults:2,children:1}],adults=[{adults:3}];h.render(family);h.effect();await flush();assert.equal(h.render(family).quote.totalPrice,17500);assert.equal(h.render(adults).quote,null);
});
