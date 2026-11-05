import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../app/admin/growth/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let callback;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='load')callback=node.initializer.arguments[0].getText(ast);ts.forEachChild(node,visit);}visit(ast);
const compiled=ts.transpileModule('globalThis.load = '+callback,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function fixture(){
 const calls=[],state={overviewReady:false,state:{},sitemapReport:null};
 const setters=Object.fromEntries(['Loading','Error','Forbidden','OverviewReady','State','SitemapReport'].map(name=>['set'+name,value=>{const key=name[0].toLowerCase()+name.slice(1);state[key]=typeof value==='function'?value(state[key]):value;}]));
 const context={...setters,initial:{sitemap:'checking',robots:'checking',searches:0},requestRef:{current:0},controllersRef:{current:new Set()},AbortController,fetch:()=>{},readGrowthEndpoint:(_fetch,url,_kind,controller)=>new Promise(resolve=>calls.push({url,resolve,controller}))};
 vm.runInNewContext(compiled,context);return{...context,calls,state};
}
const tick=async()=>{for(let n=0;n<5;n++)await Promise.resolve();};
const ok=value=>({ok:true,status:200,value,error:null});
test('actual growth callback shows independent health before a stuck overview finishes',async()=>{
 const f=fixture();const done=f.load();f.calls[1].resolve(ok({healthy:true,totalUrls:30,totalFiles:2}));f.calls[2].resolve(ok('Sitemap: /sitemap.xml'));await tick();
 assert.equal(f.state.state.sitemap,'healthy');assert.equal(f.state.state.robots,'healthy');assert.equal(f.state.overviewReady,false);assert.equal(f.state.loading,true);
 f.calls[0].resolve({ok:false,status:null,value:null,error:'timeout'});await done;assert.equal(f.state.overviewReady,false);assert.equal(f.state.loading,false);
});
test('actual403 invalidates even late fulfilled siblings and clears private data',async()=>{
 const f=fixture();const done=f.load();f.calls[0].resolve({ok:false,status:403,value:null,error:'http_403'});await tick();
 f.calls[1].resolve(ok({healthy:true,totalUrls:99}));f.calls[2].resolve(ok('Sitemap: /sitemap.xml'));await done;
 assert.equal(f.state.forbidden,true);assert.equal(f.state.overviewReady,false);assert.equal(f.state.sitemapReport,null);assert.equal(f.state.state.sitemap,'checking');assert.equal(f.state.loading,false);
});
test('actual superseded callback cannot replace the latest generation',async()=>{
 const f=fixture();const old=f.load();const latest=f.load();for(const call of f.calls.slice(3))call.resolve(ok(call.url.includes('overview')?{search:{searches:12},generatedAt:'new'}:call.url.includes('sitemap')?{healthy:true,totalUrls:2}:'Sitemap: /sitemap.xml'));await latest;
 for(const call of f.calls.slice(0,3))call.resolve(ok(call.url.includes('overview')?{search:{searches:99},generatedAt:'old'}:{}));await old;
 assert.equal(f.state.state.searches,12);assert.equal(f.state.state.generatedAt,'new');assert.equal(f.state.overviewReady,true);
});
