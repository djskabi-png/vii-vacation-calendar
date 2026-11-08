import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {Children} from 'react';
import * as jsx from 'react/jsx-runtime';

const source=readFileSync(new URL('../app/components/progressive-results.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('progressive.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const copy=ast.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='copy'));
const component=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ProgressiveResultsWindow');
assert.ok(copy&&component);
const compiled=ts.transpileModule(`${copy.getText(ast)}\n${component.getText(ast)}\nexports.component=ProgressiveResultsWindow;`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function harness(){
 let index=0, effects=[], slots=[], pending=[], observers=[];
 const useState=initial=>{const i=index++;slots[i]??={value:initial};return [slots[i].value,update=>{slots[i].value=typeof update==='function'?update(slots[i].value):update;}];};
 const useRef=initial=>{const i=index++;slots[i]??={current:initial};return slots[i];};
 const useEffect=(callback,deps)=>{const i=index++,old=effects[i];if(!old||deps.some((x,j)=>!Object.is(x,old.deps[j])))pending.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:callback()};});};
 class Observer{constructor(callback){this.callback=callback;this.active=false;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}}
 const out={};
 Function('require','exports','useMemo','useState','useRef','useEffect','Children','useSiteLanguage','signalExperienceStage','IntersectionObserver','requestAnimationFrame','cancelAnimationFrame',compiled)(()=>jsx,out,fn=>fn(),useState,useRef,useEffect,Children,()=>({language:'he'}),()=>{},Observer,()=>1,()=>{});
 const flatten=(tree,out=[])=>{for(const x of Array.isArray(tree)?tree:[tree])if(x&&typeof x==='object'){out.push(x);flatten(x.props?.children,out);}return out;};
 return {render(props){index=0;pending=[];const tree=out.component(props);const nodes=flatten(tree);for(const n of nodes)if(n.props?.ref)n.props.ref.current={};pending.forEach(fn=>fn());return nodes;},intersect(visible){const active=observers.filter(x=>x.active);assert.equal(active.length,1);active[0].callback([{isIntersecting:visible}]);}};
}
const children=Array.from({length:52},(_,i)=>jsx.jsx('article',{'data-id':i},String(i)));
const ids=tree=>tree.filter(x=>x.type==='article').map(x=>x.props['data-id']);
const button=tree=>tree.find(x=>x.type==='button');
const text=x=>typeof x==='string'?x:Array.isArray(x)?x.map(text).join(''):x?.props?text(x.props.children):'';

test('actual automatic result window retains an actionable idle fallback and every identity through successive windows',()=>{
 const h=harness(), props={children,className:'results',autoLoad:true};
 let tree=h.render(props);assert.deepEqual(ids(tree),Array.from({length:9},(_,i)=>i));
 assert.match(text(button(tree)),/הצגת 9 מקומות נוספים/);assert.doesNotMatch(text(button(tree)),/טוענים/);
 h.intersect(true);tree=h.render(props);assert.equal(ids(tree).length,18);
 h.intersect(false);tree=h.render(props);assert.match(text(button(tree)),/הצגת 9 מקומות נוספים/);
 button(tree).props.onClick();tree=h.render(props);assert.equal(ids(tree).length,27);
 for(let i=0;i<3;i++){h.intersect(true);tree=h.render(props);}
 assert.deepEqual(ids(tree),Array.from({length:52},(_,i)=>i));assert.equal(button(tree),undefined);
});

test('actual controlled window requests once per accepted count and retains manual loading when out of view',()=>{
 const h=harness();let calls=0;
 let props={children:children.slice(0,9),className:'results',autoLoad:true,totalCount:52,visibleCount:9,onShowMore:()=>calls++};
 let tree=h.render(props);assert.match(text(button(tree)),/הצגת 9 מקומות נוספים/);
 h.intersect(true);tree=h.render(props);assert.equal(calls,1);h.render(props);assert.equal(calls,1);
 props={...props,children:children.slice(0,18),visibleCount:18};tree=h.render(props);h.render(props);assert.equal(calls,2);
 h.intersect(false);tree=h.render(props);assert.match(text(button(tree)),/הצגת 9 מקומות נוספים/);
 button(tree).props.onClick();assert.equal(calls,3);
});
