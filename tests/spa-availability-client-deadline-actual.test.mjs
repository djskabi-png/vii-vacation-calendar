import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../app/components/world-map-results.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('world-map-results.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let effect;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0].getText(ast).includes('"/api/spa/availability"'))effect=node.arguments[0].getText(ast);ts.forEachChild(node,visit);}visit(ast);
assert.ok(effect,'actual spa availability effect');
const js=ts.transpileModule('globalThis.start='+effect,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function harness(healthy=false){const states=[],timers=new Map();let id=0;
  const context={requestedDate:'2026-11-06',AbortController,DOMException,Map,setAvailability:value=>states.push(value),window:{setTimeout(fn,ms){timers.set(++id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}},fetch:(_url,{signal})=>healthy?Promise.resolve(Response.json({availability:[{siteID:158,date:'2026-11-06',available:1}]})):new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))};
  vm.runInNewContext(js,context);return{states,timers,cleanup:context.start()};}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('an actual SPA availability deadline leaves loading with a retryable error',async()=>{
  const h=harness();[...h.timers.values()].find(t=>t.ms===0).fn();
  const budget=[...h.timers.values()].find(t=>t.ms>0).ms;
  assert.ok(budget>7_147&&budget<=20_000,'measured healthy production response fits a finite request budget');
  [...h.timers.values()].find(t=>t.ms>0).fn();await flush();
  assert.equal(h.states.at(-1).status,'unavailable');h.cleanup();
});
test('leaving or replacing a dated search cannot apply a late failure',async()=>{
  const h=harness();h.cleanup();await flush();assert.equal(h.states.length,0);assert.equal(h.timers.size,0);
});
test('successful availability clears its deadline and preserves selected date',async()=>{
  const h=harness(true);await flush();
  assert.equal(h.states.at(-1).status,'ready');assert.equal(h.states.at(-1).checkedDate,'2026-11-06');
  assert.equal([...h.timers.values()].some(t=>t.ms>0),false);h.cleanup();
});
