import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as React from 'react';
import {renderToString} from 'react-dom/server';
import {createRoot,hydrateRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {fetchPublishedSearchCatalog,peekFreshPublishedSearchCatalog} from '../app/lib/published-catalog-client-cache.ts';
import {discoveryJson} from '../app/lib/discovery-client-cache.ts';

let sequence=0;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const identity=value=>value;
function hookFixture(seed=null){
  let peeks=0;
  const req=name=>{
    if(name==='react')return React;
    if(name.includes('published-catalog-seed'))return{usePublishedCatalogSeed:()=>seed};
    if(name.includes('published-catalog-client-cache'))return{fetchPublishedSearchCatalog,peekFreshPublishedSearchCatalog:world=>{peeks++;return peekFreshPublishedSearchCatalog(world);}};
    if(name.includes('discovery-client-cache'))return{discoveryJson};
    throw Error('unexpected_import:'+name);
  };
  const code=ts.transpileModule(readFileSync('app/lib/use-published-catalog.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};new Function('require','module','exports',code)(req,module,module.exports);
  const snapshots=[];
  function View({world='vacations',view,tick=0}){
    const value=module.exports.usePublishedCatalog(world,identity,view);
    snapshots.push({items:value.items,loading:value.loading,error:value.error,tick});
    return React.createElement('pre',null,JSON.stringify({items:value.items,loading:value.loading}));
  }
  return{View,snapshots,peeks:()=>peeks};
}
async function environment(run){
  const keys=['window','document','navigator','HTMLElement','Element','Node','MutationObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT'];
  const original=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const oldFetch=globalThis.fetch,oldNow=Date.now;
  let now=oldNow()+ ++sequence*1_000_000,reads=0,dom,root;
  Date.now=()=>now;
  delete globalThis.window;delete globalThis.document;
  globalThis.fetch=async()=>{reads++;return new Response(JSON.stringify({entries:[{summary:{id:7,name:'Accepted browser catalog'}}]}),{headers:{'content-type':'application/json'}});};
  const install=(html='')=>{
    dom=new JSDOM('<!doctype html><div id="root">'+html+'</div>',{url:'https://fixture.test/vacations/kinneret',pretendToBeVisual:true});
    const values={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,MutationObserver:dom.window.MutationObserver,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
    for(const [key,value]of Object.entries(values))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
    return dom.window.document.getElementById('root');
  };
  try{await run({install,advance:ms=>now+=ms,reads:()=>reads,setRoot:value=>root=value});}
  finally{
    if(root)await React.act(async()=>{await pause(120);root.unmount();});
    dom?.window.close();
    for(const [key,descriptor]of original){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
    globalThis.fetch=oldFetch;Date.now=oldNow;
  }
}

test('actual client-navigation mount uses the fresh accepted snapshot on its first render and clones once',()=>environment(async e=>{
  await fetchPublishedSearchCatalog('vacations');
  const fixture=hookFixture(),container=e.install(),root=createRoot(container);e.setRoot(root);
  await React.act(async()=>root.render(React.createElement(fixture.View)));
  assert.deepEqual(fixture.snapshots[0].items,[{id:7,name:'Accepted browser catalog'}]);
  assert.equal(fixture.snapshots[0].loading,false);
  await React.act(async()=>root.render(React.createElement(fixture.View,{tick:1})));
  assert.equal(fixture.peeks(),1,'a rerender/keystroke cannot clone the whole catalog again');
  assert.equal(e.reads(),1,'fresh reuse performs no second network request');
}));

test('actual server seed wins, even when a seed record has its own summary field',()=>environment(async e=>{
  await fetchPublishedSearchCatalog('vacations');
  const record={id:42,summary:'A legitimate supplier field'},fixture=hookFixture({entries:[record],complete:true});
  const root=createRoot(e.install());e.setRoot(root);
  await React.act(async()=>root.render(React.createElement(fixture.View)));
  assert.deepEqual(fixture.snapshots[0].items,[record]);
  assert.equal(fixture.snapshots[0].loading,false);assert.equal(fixture.peeks(),0);
}));

test('real SSR and hydration preserve the server snapshot despite a populated browser cache',()=>environment(async e=>{
  await fetchPublishedSearchCatalog('vacations');
  const fixture=hookFixture(),element=React.createElement(fixture.View);
  const html=renderToString(element);
  assert.deepEqual(fixture.snapshots[0].items,[]);assert.equal(fixture.snapshots[0].loading,true);assert.equal(fixture.peeks(),0);
  fixture.snapshots.length=0;
  const container=e.install(html),errors=[];
  await React.act(async()=>{e.setRoot(hydrateRoot(container,element,{onRecoverableError:error=>errors.push(error.message)}));});
  await React.act(async()=>pause(60));
  assert.deepEqual(fixture.snapshots[0].items,[],'the hydration render must match server HTML');
  assert.equal(errors.length,0,errors.join('\n'));
  assert.match(container.textContent,/Accepted browser catalog/);
  assert.equal(e.reads(),1);
}));

test('expired snapshots are not used for initial navigation while a normal refresh remains available',()=>environment(async e=>{
  await fetchPublishedSearchCatalog('vacations');e.advance(60_000);
  const fixture=hookFixture(),root=createRoot(e.install());e.setRoot(root);
  await React.act(async()=>root.render(React.createElement(fixture.View)));
  assert.deepEqual(fixture.snapshots[0].items,[]);assert.equal(fixture.snapshots[0].loading,true);
  await React.act(async()=>pause(60));assert.equal(e.reads(),2);
  assert.match(document.getElementById('root').textContent,/Accepted browser catalog/);
}));

test('an accepted empty catalog is complete and card projections cannot borrow a search snapshot',()=>environment(async e=>{
  globalThis.fetch=async()=>new Response(JSON.stringify({entries:[]}),{headers:{'content-type':'application/json'}});
  await fetchPublishedSearchCatalog('vacations');
  const empty=hookFixture(),root=createRoot(e.install());e.setRoot(root);
  await React.act(async()=>root.render(React.createElement(empty.View)));
  assert.deepEqual(empty.snapshots[0].items,[]);assert.equal(empty.snapshots[0].loading,false);
  await React.act(async()=>root.unmount());e.setRoot(null);
  const cards=hookFixture(),cardRoot=createRoot(document.getElementById('root'));e.setRoot(cardRoot);
  await React.act(async()=>cardRoot.render(React.createElement(cards.View,{view:'cards'})));
  assert.equal(cards.peeks(),0);assert.equal(cards.snapshots[0].loading,true);
}));


test('actual thin-model recovery performs one server refresh per view and does not loop on new callbacks',()=>environment(async e=>{
 const code=ts.transpileModule(readFileSync('app/lib/use-catalog-navigation-recovery.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};new Function('require','module','exports',code)(()=>React,module,module.exports);
 let refreshes=0;
 function Recovery({needed,path}){module.exports.useCatalogNavigationRecovery(path,needed,()=>refreshes++);return null;}
 const container=e.install(),root=createRoot(container);e.setRoot(root);
 const render=async(needed,path='/vacations/kinneret')=>React.act(async()=>root.render(React.createElement(Recovery,{needed,path})));
 await render(false);assert.equal(refreshes,0);
 await render(true);await render(true);await render(false);await render(true);assert.equal(refreshes,1);
 await render(true,'/vacations/north');assert.equal(refreshes,2);
}));
