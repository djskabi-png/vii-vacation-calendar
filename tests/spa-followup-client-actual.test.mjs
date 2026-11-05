import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {scheduleSpaDealFollowup} from '../app/lib/spa-followup.ts';
const source=readFileSync(new URL('../app/components/spa-package-deals.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('spa-package-deals.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let effect,reset;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'){
 const body=node.arguments[0].getText(ast);if(body.includes('discoveryJson<DealResponse>'))effect=body;
 if(body.includes('followupKeyRef.current !== requestKey'))reset=body;
}ts.forEachChild(node,visit);}visit(ast);assert.ok(effect);assert.ok(reset);
const js=ts.transpileModule(`globalThis.start=${effect};globalThis.reset=${reset}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){let id=0,attempt=0,result={key:'',data:null,status:'loading'};const timers=new Map(),requests=[];
 const window={setTimeout(fn,ms){timers.set(++id,{fn,ms});return id;},clearTimeout(key){timers.delete(key);}};
 const context={AbortController,clockKey:'fixture',regionLabel:undefined,requestKey:'a',requestedDate:'',fixedDate:undefined,fixedWeekday:undefined,fixedDateOffset:undefined,URLSearchParams,window,followupKeyRef:{current:'a'},followupCountRef:{current:0},
 setResult(value){result=typeof value==='function'?value(result):value;},setAttempt(value){attempt=value(attempt);},
 scheduleSpaDealFollowup:(status,count,fn)=>scheduleSpaDealFollowup(status,count,fn,window.setTimeout),
 discoveryJson(url,optionsKey,options){return new Promise((resolve,reject)=>requests.push({resolve,reject,options,url}));}};
 vm.runInNewContext(js,context);return{context,timers,requests,start:()=>context.start(),reset:()=>context.reset(),result:()=>result,attempt:()=>attempt,
 fire(){const[key,timer]=[...timers][0];timers.delete(key);timer.fn();return timer.ms;}};
}
const body=status=>({days:['2026-11-06'],offers:{'2026-11-06':{single:[{packageId:1}]}},checkedAt:'2026-11-05T12:00:00Z',availabilityStatus:status});
test('actual SPA effect follows refreshing twice, then stops without losing usable data',async()=>{
 const h=harness();let cleanup=h.start();assert.equal(h.requests[0].options.cache,'no-store','followups must bypass a previously cached refreshing HTTP response');h.requests[0].resolve(body('refreshing'));await flush();assert.equal(h.timers.size,1);assert.equal(h.fire(),2000);assert.equal(h.attempt(),1);cleanup();
 cleanup=h.start();h.requests[1].resolve(body('refreshing'));await flush();assert.equal(h.fire(),4000);assert.equal(h.attempt(),2);cleanup();
 cleanup=h.start();h.requests[2].resolve(body('refreshing'));await flush();assert.equal(h.timers.size,0);assert.equal(h.result().status,'error');assert.equal(h.result().data,null);assert.equal(h.requests.length,3);cleanup();
});
test('actual SPA effect stops on verified and resets the followup budget for a new request',async()=>{
 const h=harness();let cleanup=h.start();h.requests[0].resolve(body('refreshing'));await flush();h.fire();cleanup();cleanup=h.start();h.requests[1].resolve(body('verified'));await flush();assert.equal(h.timers.size,0);cleanup();
 h.context.requestKey='b';h.reset();assert.equal(h.context.followupCountRef.current,0);cleanup=h.start();h.requests[2].resolve(body('refreshing'));await flush();assert.equal([...h.timers.values()][0].ms,2000);cleanup();assert.equal(h.timers.size,0);
});
test('actual SPA cleanup cancels old timers and late responses; failed followup retains the last useful result',async()=>{
 const h=harness();let cleanup=h.start();h.requests[0].resolve(body('verified'));await flush();cleanup();
 cleanup=h.start();h.requests[1].resolve(body('refreshing'));await flush();cleanup();assert.equal(h.timers.size,0);assert.equal(h.requests[1].options.signal.aborted,true);
 cleanup=h.start();h.requests[2].reject(Error('offline'));await flush();assert.equal(h.result().status,'ready');assert.equal(h.result().data.availabilityStatus,'verified');cleanup();
 cleanup=h.start();const previous=h.result();cleanup();h.requests[3].resolve(body('verified'));await flush();assert.equal(h.result(),previous);assert.equal(h.timers.size,0);
});
