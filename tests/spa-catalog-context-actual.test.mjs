import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const compile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;

test('one accepted catalog refresh updates both SPA count and result items while the initial snapshot stays visible',async()=>{
  const initial=[{id:'spa-1',name:'old'},{id:'spa-2',name:'retired'}],cells=[],effects=[],idle=[],requests=[];
  let cursor=0,first=true,resolveRequest;
  const react={startTransition:fn=>fn(),createContext:initial=>{const ctx={current:initial};ctx.Provider={ctx};return ctx;},useContext:ctx=>ctx.current,
    useState:initial=>{const index=cursor++;if(!(index in cells))cells[index]=typeof initial==='function'?initial():initial;return[cells[index],value=>cells[index]=typeof value==='function'?value(cells[index]):value];},
    useRef:initial=>{const index=cursor++;return cells[index]??(cells[index]={current:initial});},useEffect:fn=>{if(first)effects.push(fn);}};
  const jsx={jsx(type,props){if(type?.ctx)type.ctx.current=props.value;return{type,props};},Fragment:'fragment'};
  const seed={entries:initial,complete:true};
  const context={AbortController,Date,console,window:{requestIdleCallback(fn){idle.push(fn);return 1;},cancelIdleCallback(){}},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},fetch(){throw Error('cards must use the bounded body reader');}};
  const hookExports={};context.exports=hookExports;context.require=id=>id==='react'?react:id.includes('published-catalog-seed')?{usePublishedCatalogSeed:()=>seed}:id.includes('discovery-client-cache')?{discoveryJson:(url,key,options)=>{requests.push({url,key,options});return new Promise(resolve=>resolveRequest=resolve);}}:{};
  vm.runInNewContext('(function(){'+compile('../app/lib/use-published-catalog.ts')+'\n})()',context);
  const providerExports={};context.exports=providerExports;context.require=id=>id==='react'?react:id==='react/jsx-runtime'?jsx:id.includes('use-published-catalog')?hookExports:{};
  vm.runInNewContext('(function(){'+compile('../app/components/spa-catalog-context.tsx')+'\n})()',context);
  const render=()=>{cursor=0;const provider=providerExports.SpaCatalogProvider({children:null});first=false;return provider;};
  render();const cleanup=effects[0]();
  assert.equal(providerExports.SpaCatalogCount({fallback:99}).props.children,2);
  assert.equal(requests.length,0);idle[0]();assert.equal(requests.length,1);
  assert.equal(requests[0].url,'/api/catalog?world=spa&view=cards');assert.equal(requests[0].options.timeoutMs,10000);
  assert.equal(providerExports.useSpaCatalogItems().length,2);
  resolveRequest({entries:[{supplierId:1,summary:{id:'spa-1',name:'accepted',priceLabel:'₪ 500'}}]});
  await new Promise(resolve=>setImmediate(resolve));render();
  assert.equal(providerExports.SpaCatalogCount({fallback:99}).props.children,1);
  assert.equal(providerExports.useSpaCatalogItems()[0].name,'accepted');
  assert.equal(providerExports.useSpaCatalogItems()[0].priceLabel,'₪ 500');
  assert.equal(requests.length,1);cleanup();assert.equal(requests[0].options.signal.aborted,true);
});
