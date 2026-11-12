import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../app/lib/navigation-intent-warmup.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { createNavigationIntentWarmup, warmNavigationDocument } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const tick = () => new Promise(resolve => setImmediate(resolve));

test('one intended destination warms either HTML or Flight and deduplicates repeated intent', async () => {
  const calls = [];
  let clock = 100;
  const warm = createNavigationIntentWarmup({ now: () => clock, prefetch: href => calls.push(['flight', href]), document: async href => calls.push(['html', href]) });
  warm.warm('/business?id=1', true);
  warm.warm('/business?id=1', true);
  warm.warm('/events', false);
  await tick();
  assert.deepEqual(calls, [['flight','/events'], ['html','/business?id=1']]);
  clock += 60001;
  warm.warm('/events', false);
  assert.equal(calls.length, 3);
  warm.dispose();
});

test('document speculation is limited to one active request and does not queue a burst', async () => {
  const calls = [];
  const warm = createNavigationIntentWarmup({ prefetch: () => assert.fail('new-tab intent cannot also prefetch Flight'), document: (href, signal) => new Promise(resolve => {
    calls.push({ href, signal, resolve });
    signal.addEventListener('abort', resolve, { once: true });
  }) });
  for (let i=0;i<30;i++) warm.warm(`/business?id=${i}`, true);
  await tick();
  assert.equal(calls.length, 1);
  calls[0].resolve();
  await tick();
  assert.equal(calls.length, 1);
  warm.dispose();
  await tick();
  assert.ok(calls.slice(1).every(call => call.signal.aborted));
  assert.equal(calls.length, 1);
});

test('deadline aborts a hung speculation without starting another destination', async () => {
  const calls = [];
  let firstAborted;
  const aborted = new Promise(resolve => { firstAborted = resolve; });
  const warm = createNavigationIntentWarmup({ timeoutMs: 15, prefetch: () => {}, document: (href, signal) => {
    calls.push(href);
    signal.addEventListener('abort', firstAborted, { once: true });
    return new Promise(() => {});
  } });
  warm.warm('/one', true); warm.warm('/two', true); warm.warm('/three', true);
  await aborted;
  await tick();
  assert.deepEqual(calls, ['/one']);
  assert.equal(calls.filter(x => x === '/one').length, 1);
  warm.dispose();
});

test('document read is streamed and bounded, never materialized as a full ArrayBuffer', async () => {
  const original = globalThis.fetch;
  let reads = 0; let cancelled = 0;
  globalThis.fetch = async (_href, init) => {
    assert.equal(init.headers.Accept, 'text/html,application/xhtml+xml');
    assert.equal(init.credentials, 'same-origin');
    return { body: { getReader: () => ({ read: async () => ({ done: false, value: new Uint8Array(1024*1024) }), cancel: async () => { cancelled++; } }) } };
  };
  // Count the reads without changing the production function.
  const fetchStub = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    const response = await fetchStub(...args);
    const get = response.body.getReader;
    response.body.getReader = () => { const reader=get(); const read=reader.read; reader.read=()=>{ reads++; return read(); }; return reader; };
    return response;
  };
  try { await warmNavigationDocument('/business?id=1', new AbortController().signal); }
  finally { globalThis.fetch=original; }
  assert.equal(reads, 3); assert.equal(cancelled, 1);
});

test('actual mobile place touch cancels desktop dwell without racing the Link Flight request',async()=>{
 const source=await readFile(new URL('../app/components/smart-navigation-warmup.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('component.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),handlers={};
 const visit=node=>{if(ts.isVariableDeclaration(node)&&['onTouchStart','onClick'].includes(node.name.getText(ast)))handlers[node.name.getText(ast)]=node.initializer.getText(ast);ts.forEachChild(node,visit);};visit(ast);
 const calls=[];class FakeElement{closest(){return {hasAttribute:()=>false,getAttribute:()=>'/business?id=vacation-164'};}};
 const deps={Element:FakeElement,isBusinessDepthRoute:path=>path.startsWith('/business'),stripLanguagePrefix:x=>x,warmup:{warm:(href,documentOnly)=>calls.push(['warm',href,documentOnly]),cancel:href=>calls.push(['cancel',href])},window:{location:{pathname:'/events',origin:'https://vii.spaplus.co'},matchMedia:()=>({matches:true}),clearTimeout:()=>{}},localizedPath:href=>href,languageFromPathname:()=> 'he',dwell:new Map()};
 const load=text=>new Function(...Object.keys(deps),ts.transpileModule(`return (${text});`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(...Object.values(deps));
 load(handlers.onTouchStart)({target:new FakeElement()});assert.deepEqual(calls,[]);
 const target={closest:()=>({href:'https://vii.spaplus.co/business?id=vacation-164',getAttribute:()=>'/business?id=vacation-164'})};
 load(handlers.onClick)({defaultPrevented:false,target});assert.deepEqual(calls,[['cancel','/business?id=vacation-164']]);
 load(handlers.onClick)({defaultPrevented:true,target});assert.equal(calls.length,1);
});

test('actual component anchor handler excludes private/API links and chooses one destination mode', async () => {
  const component = await readFile(new URL('../app/components/smart-navigation-warmup.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('component.tsx', component, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(ast)==='warmAnchor') initializer=node.initializer.getText(ast); ts.forEachChild(node,visit); };
  visit(ast); assert.ok(initializer);
  const fnJS=ts.transpileModule(`const dwell=new Map(); const handle=${initializer}; return handle;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const calls=[];
  class FakeElement { constructor(anchor){this.anchor=anchor;} closest(){return this.anchor;} }
  const handle=new Function('Element','localizedPath','languageFromPathname','window','stripLanguagePrefix','isBusinessDepthRoute','warmup','Node', fnJS)(FakeElement,href=>href,()=> 'he',{location:{origin:'https://vii.spaplus.co',pathname:'/'},matchMedia:()=>({matches:false}),setTimeout:fn=>{fn();return 1},clearTimeout:()=>{}},x=>x,x=>x.startsWith('/business'),{warm:(...args)=>calls.push(args),cancel:()=>{}},class Node {});
  const anchor=(href,target='')=>new FakeElement({getAttribute:()=>href,hasAttribute:()=>false,target});
  handle(anchor('/business?id=2')); handle(anchor('/events')); handle(anchor('/guides','_blank'));
  handle(anchor('/api/catalog')); handle(anchor('/admin')); handle(anchor('/booking?id=2')); handle(anchor('//external.example'));
  assert.deepEqual(calls,[['/business?id=2',true],['/events',false],['/guides',true]]);
});
