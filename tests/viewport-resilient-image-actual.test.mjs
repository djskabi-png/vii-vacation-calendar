import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {observeSectionActivation} from '../app/lib/section-activation.ts';
const source=fs.readFileSync('app/components/viewport-resilient-image.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function load(react,jsx,observe,Original){const exports={};new Function('require','exports',code)(name=>name==='react'?react:name==='react/jsx-runtime'?jsx:name.endsWith('resilient-image')?{ResilientImage:Original}:{observeSectionActivation:observe},exports);return exports.ViewportResilientImage;}
const props={src:'/api/vii/media/99619cd26c2d850.JPG',alt:'Original room identity',width:'960',height:'640',loading:'lazy',onFailure(){}};
test('SSR keeps dimensions without an early image request and preserves the real no-JS source',()=>{
 return import('react/jsx-runtime').then(runtime=>{const Actual=load(React,runtime,observeSectionActivation,()=>null);const html=renderToStaticMarkup(React.createElement(Actual,props));const [placeholder,noscript]=html.split('<noscript>');assert.ok(noscript);assert.doesNotMatch(placeholder,/\ssrc(?:set)?=/i);assert.match(placeholder,/width="960" height="640"/);assert.match(noscript,/src="\/api\/vii\/media\/99619cd26c2d850.JPG"/);assert.match(noscript,/data-vii-room-placeholder/);assert.match(noscript,/Original room identity/);});
});
function fixture(observerAvailable=true){
 let active=false,effect,cleanup,observed,instance,failed=0;
 const listeners=new Map();const button={addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:(k)=>listeners.delete(k)};
 const image={closest:()=>button};
 class Observer{constructor(cb,options){this.cb=cb;this.options=options;instance=this;}observe(el){observed=el;}disconnect(){this.disconnected=true;}}
 const react={useState:()=>[active,v=>{active=v;}],useRef:()=>({current:image}),useEffect:fn=>{effect=fn;}};
 const jsx=(type,props)=>({type,props});const Original=()=>null;
 const Component=load(react,{jsx,jsxs:jsx,Fragment:'fragment'},(el,start)=>observeSectionActivation(el,start,observerAvailable?Observer:undefined),Original);
 const given={...props,onFailure:()=>failed++};
 const render=()=>Component(given);const first=render();cleanup=effect();
 return{first,render,Original,given,listeners,get observed(){return observed;},get observer(){return instance;},cleanup,failures:()=>failed};
}
test('offscreen room makes no request; approaching viewport keeps exact original failure and gallery source',()=>{
 const f=fixture();assert.equal(f.first.props.children[0].type,'img');assert.equal(f.first.props.children[0].props.src,undefined);assert.equal(f.observed!==undefined,true);assert.equal(f.observer.options.rootMargin,'400px 0px');
 f.observer.cb([{isIntersecting:false}]);assert.equal(f.render().props.children[0].type,'img');
 f.observer.cb([{isIntersecting:true}]);const actual=f.render().props.children[0];assert.equal(actual.type,f.Original);assert.equal(actual.props.src,props.src);assert.equal(actual.props.width,'960');actual.props.onFailure();assert.equal(f.failures(),1);assert.equal(f.observer.disconnected,true);
});
test('parent-button focus or pointer activates; cleanup prevents late activation; unsupported observer falls back',()=>{
 for(const event of ['focusin','pointerdown']){const f=fixture();f.listeners.get(event)();assert.equal(f.render().props.children[0].type,f.Original);}
 const stopped=fixture();stopped.cleanup();stopped.observer.cb([{isIntersecting:true}]);assert.equal(stopped.render().props.children[0].type,'img');
 const legacy=fixture(false);assert.equal(legacy.render().props.children[0].type,legacy.Original);
});
test('only business room photos and its belowfold map opt into staged work',()=>{
 const page=fs.readFileSync('app/business/client-page.tsx','utf8');assert.equal((page.match(/<ViewportResilientImage/g)||[]).length,2);assert.match(page,/useSectionActivation\("location", !mapActivated\)/);assert.match(page,/locationMapVisible \? <DeferredListingMap listings=\{\[localizedMapProperty\]\} single autoLoad=\{mapActivated\}/);assert.match(page,/className="listing-map-shell single-map" aria-hidden="true"/);assert.match(page,/setMapActivated\(true\)/);
});
