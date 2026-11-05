import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('layout.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let script;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='apiHydrationGate')script=node.initializer.text;ts.forEachChild(node,visit);}visit(ast);assert.ok(script);
function fixture(readyState='loading'){
 const events=new Map(),frames=[],calls=[],timers=new Map();let timerId=0;
 const original=(input,init)=>{calls.push({input,init});return Promise.resolve({ok:true});};
 const document={readyState,addEventListener:(name,fn)=>events.set('document:'+name,fn)};
 const window={fetch:original,addEventListener:(name,fn)=>events.set('window:'+name,fn),requestAnimationFrame:fn=>frames.push(fn)};
 vm.runInNewContext(script,{window,document,location:{href:'https://vii.spaplus.co/',origin:'https://vii.spaplus.co'},URL,Promise,DOMException,requestAnimationFrame:fn=>frames.push(fn),setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id)});
 const release=async()=>{events.get('document:DOMContentLoaded')?.();for(let i=0;i<4;i++){const now=frames.splice(0);now.forEach(fn=>fn());await Promise.resolve();}};
 return{window,events,calls,timers,original,release};
}
test('actual inline bootstrap releases API before image load, with no fixed800ms delay',{timeout:1000},async()=>{
 const f=fixture();f.window.fetch('/api/catalog');await f.window.fetch('/fonts/heebo.woff2');assert.equal(f.calls.length,1);await f.release();
 assert.deepEqual(f.calls.map(c=>c.input),['/fonts/heebo.woff2','/api/catalog']);assert.equal(f.window.fetch,f.original);assert.equal(f.timers.size,0);assert.equal(f.events.has('window:load'),false);
});
test('an already interactive document starts discovery without waiting for unrelated assets',{timeout:1000},async()=>{
 const f=fixture('interactive');f.window.fetch('/api/vii/home-holiday-deals');await f.release();assert.equal(f.calls.length,1);
});
test('queued aborted API never starts; external/API-like names do not get gated',{timeout:1000},async()=>{
 const f=fixture();const controller=new AbortController();const pending=f.window.fetch('/api/catalog',{signal:controller.signal});const rejected=assert.rejects(pending,error=>error.name==='AbortError');controller.abort();
 await f.window.fetch('https://supplier.example/api/public');await f.window.fetch('/apiculture');await f.release();await rejected;
 assert.deepEqual(f.calls.map(c=>c.input),['https://supplier.example/api/public','/apiculture']);
});
test('background-tab frame throttling cannot strand API reads behind a frame callback',{timeout:1000},async()=>{
 const f=fixture('interactive');f.window.fetch('/api/catalog');const timer=[...f.timers.values()][0];assert.equal(timer.ms,100);timer.fn();await Promise.resolve();await Promise.resolve();assert.equal(f.calls.length,1);assert.equal(f.window.fetch,f.original);
});
