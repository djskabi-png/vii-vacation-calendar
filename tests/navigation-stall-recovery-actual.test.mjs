import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { NAVIGATION_START_EVENT, NAVIGATION_RECOVERY_DELAY_MS, recoverStalledNavigation } from '../app/lib/navigation-recovery.ts';
const source=fs.readFileSync(new URL('../app/components/navigation-progress.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('navigation-progress.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const effects=[];
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect')effects.push(node.arguments[0]);ts.forEachChild(node,visit);}visit(ast);
function fixture(){
 const tasks=new Map(),events=new Map(),values=new Map(),replaced=[];let next=0;
 const location={href:'https://vii.spaplus.co/booking?place=vacation-11',origin:'https://vii.spaplus.co',pathname:'/booking',search:'?place=vacation-11',replace:href=>replaced.push(href)};
 const ctx={pathname:'/booking',searchParams:new URLSearchParams(location.search),timer:{current:null},pendingHref:{current:null},committedRoute:{current:'/booking?place=vacation-11'},active:false,setActive:value=>{ctx.active=value;},URL,NAVIGATION_START_EVENT,NAVIGATION_RECOVERY_DELAY_MS,recoverStalledNavigation,
 Date:{now:()=>100000},setTimeout:(callback,ms)=>{tasks.set(++next,{callback,ms});return next;},clearTimeout:id=>tasks.delete(id),window:{location,sessionStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)},document:{documentElement:{dataset:{}},addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)}};
 const callbacks=effects.map(effect=>new Function('ctx',`with(ctx){return ${ts.transpileModule(`const effect=${effect.getText(ast)};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText.replace(/^const effect\s*=\s*/,'').replace(/;\s*$/,'')};}`)(ctx));
 const cleanup=callbacks[1]();
 return {ctx,tasks,events,values,replaced,commit:callbacks[0],cleanup,start:href=>events.get(NAVIGATION_START_EVENT)({detail:{href}}),fire:()=>{const [id,task]=[...tasks.entries()][0];tasks.delete(id);task.callback();}};
}
test('actual router/back recovery retains exact target and is bounded to one document GET',()=>{
 const f=fixture();f.start('/?from=2026-11-05&guests=6#home-live-deals');assert.equal(f.ctx.active,true);assert.equal([...f.tasks.values()][0].ms,8000);f.fire();
 assert.deepEqual(f.replaced,['https://vii.spaplus.co/?from=2026-11-05&guests=6#home-live-deals']);f.start('/trails?area=North');f.fire();assert.equal(f.replaced.length,1);assert.deepEqual([...f.values.keys()],['vii-navigation-recovery-at']);
});
test('visible commit and superseded navigation cancel recovery rather than sending the user backwards',()=>{
 const f=fixture();f.start('/events');f.start('/trails?area=North');assert.equal(f.tasks.size,1);f.ctx.pathname='/trails';f.ctx.searchParams=new URLSearchParams('area=North');f.commit();assert.equal(f.tasks.size,0);assert.equal(f.ctx.active,false);assert.equal(f.ctx.pendingHref.current,null);
 f.start('/spas');f.start('/trails?area=North');assert.equal(f.tasks.size,0);assert.equal(f.ctx.pendingHref.current,null);assert.equal(f.replaced.length,0);f.cleanup();
});
test('external, API and storage-denied recoveries never navigate or replay an action',()=>{
 const f=fixture();for(const href of ['https://example.com/','/api/admin/catalog-sync']) assert.equal(recoverStalledNavigation(href,{currentHref:f.ctx.window.location.href,now:100000,storage:f.ctx.window.sessionStorage,replace:v=>f.replaced.push(v)}),false);
 assert.equal(recoverStalledNavigation('/search',{currentHref:f.ctx.window.location.href,now:100000,storage:{getItem:()=>{throw Error('denied');},setItem:()=>{}},replace:v=>f.replaced.push(v)}),false);assert.equal(f.replaced.length,0);
});
