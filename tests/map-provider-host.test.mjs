import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

function load(path,require) {
  const source=fs.readFileSync(path,'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(code,{exports,require});return exports;
}
function fixture(language='he') {
  const Boundary=load('app/components/map-provider-boundary.tsx',name=>name==='react'?React:name==='react/jsx-runtime'?jsxRuntime:{default:({children,...props})=>React.createElement('a',props,children)}).MapProviderBoundary;
  let state=[],cursor=0,preloads=0,resets=0;
  const hookReact={useState(initial){const index=cursor++;if(!(index in state))state[index]=initial;return[state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},useCallback:fn=>fn};
  function LeafletFixture() {throw Error('controlled provider render failure');}
  const module=load('app/components/map/map-provider-host.tsx',name=>name==='react'?hookReact:name==='react/jsx-runtime'?jsxRuntime:name.includes('locale-provider')?{useSiteLanguage:()=>({language})}:name.includes('map-provider-boundary')?{MapProviderBoundary:Boundary}:{LeafletPlacesMap:LeafletFixture,preloadLeaflet:async()=>{preloads++;return 'loaded';},resetLeafletProvider:()=>resets++});
  return {Boundary,module,render(props){cursor=0;return module.MapProviderHost(props);},counts:()=>({preloads,resets})};
}

test('an outer provider-neutral boundary owns the implementation component and forwards the exact normalized result/selection contract',async()=>{
  const f=fixture();let selected,visible,closed=0;
  const places=[{id:'one',name:'Place one',lat:32.1,lng:34.8,href:'/business?id=vacation-1&guests=6',precision:'exact',markerLabel:'₪900',markerKind:'price'}];
  const props={places,initialPlaceIds:['one'],tone:'events',activePlaceId:'one',autoLoad:true,onActivePlaceChange:id=>selected=id,onVisiblePlaceIdsChange:ids=>visible=ids,onClose:()=>closed++};
  const tree=f.render(props);
  assert.equal(tree.type,f.Boundary);assert.equal(tree.props.children.type,f.module.defaultMapProvider.Component);
  assert.equal(tree.props.places,places);assert.equal(tree.props.children.props.places,places);assert.equal(tree.props.children.props.initialPlaceIds,props.initialPlaceIds);
  assert.equal(tree.props.children.props.activePlaceId,'one');assert.equal(tree.props.children.props.tone,'events');
  tree.props.children.props.onActivePlaceChange('one');tree.props.children.props.onVisiblePlaceIdsChange(['one']);tree.props.onClose();
  assert.equal(selected,'one');assert.deepEqual(visible,['one']);assert.equal(closed,1);
  assert.equal(await f.module.preloadDefaultMapProvider(),'loaded');assert.equal(f.counts().preloads,1);
  const firstKey=tree.props.children.key;tree.props.onRetry();const retried=f.render(props);
  assert.notEqual(retried.props.children.key,firstKey);assert.equal(f.counts().resets,1);assert.equal(retried.props.places,places);
});

test('a replacement provider uses the same normalized contract without changing world data or importing a different business API',()=>{
  const f=fixture('fr');let resets=0;
  function Replacement() {return null;}
  const provider={id:'replacement-fixture',Component:Replacement,reset(){resets++;}};
  const places=[{id:'spa-2',name:'Spa',href:'/discover/place/spa-2',lat:32.2,lng:34.9,precision:'area'}];
  const tree=f.render({provider,places,tone:'spa'});
  assert.equal(tree.type,f.Boundary);assert.equal(tree.props.children.type,Replacement);assert.equal(tree.props.children.props.places,places);
  assert.equal(tree.props.children.props.provider,undefined);assert.equal(tree.props.language,'fr');
  tree.props.onRetry();assert.equal(resets,1);assert.equal(f.counts().resets,0);
});

test('render or reset failure preserves all destinations and an explicit return to the list in every locale',()=>{
  for(const language of ['he','en','ru','fr']) {
    const f=fixture(language);let closes=0;
    const places=Array.from({length:9},(_,i)=>({id:String(i),name:`Place ${i}`,href:`/business?id=vacation-${i}&from=2026-11-20&guests=4`}));
    const props={places,tone:'vacation',onClose:()=>closes++,provider:{id:'reset-failure-fixture',Component:()=>null,reset(){throw Error('controlled reset error');}}};
    const tree=f.render(props),boundary=new f.Boundary(tree.props);
    boundary.setState=update=>{boundary.state={...boundary.state,...update};};
    boundary.state={...boundary.state,...f.Boundary.getDerivedStateFromError(new Error('controlled render error'))};
    const fallback=boundary.render(),html=renderToStaticMarkup(fallback);
    assert.equal((html.match(/<a /g)||[]).length,9);assert.ok(html.includes('vacation-8&amp;from=2026-11-20&amp;guests=4'));
    const buttons=fallback.props.children.filter(child=>child?.type==='button');assert.equal(buttons.length,2);buttons[1].props.onClick();assert.equal(closes,1);
    buttons[0].props.onClick();const resetFailure=f.render(props);assert.ok(resetFailure.props.providerError);
    const failedAgain=new f.Boundary(resetFailure.props);assert.equal((renderToStaticMarkup(failedAgain.render()).match(/<a /g)||[]).length,9);
  }
});

test('large failure inventories render 25 links at a time and retain every result for explicit incremental access',()=>{
  const f=fixture(),places=Array.from({length:78},(_,i)=>({id:String(i),name:`Place ${i}`,href:`/business?id=vacation-${i}`}));
  const boundary=new f.Boundary(f.render({places}).props);
  boundary.state={...boundary.state,failed:true};
  boundary.setState=update=>{boundary.state={...boundary.state,...(typeof update==='function'?update(boundary.state):update)};};
  for(const expected of [25,50,75,78]) {
    const element=boundary.render(),html=renderToStaticMarkup(element);
    assert.equal((html.match(/<a /g)||[]).length,expected);
    assert.ok(html.includes(`vacation-${expected-1}`));
    const more=element.props.children.at(-1);
    if(expected<78){assert.equal(more.type,'button');more.props.onClick();}else assert.equal(more,false);
  }
  assert.equal(boundary.props.places.length,78);
});
