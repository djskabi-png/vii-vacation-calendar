import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../app/admin/catalog-sync/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let fn,load,toggle,effect;
function scan(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='RunDiagnostics')fn=n;ts.forEachChild(n,scan);}scan(ast);
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='load')load=n.initializer.arguments[0].getText(ast);if(ts.isJsxAttribute(n)&&n.name.getText(ast)==='onToggle')toggle=n.initializer.expression.getText(ast);if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect')effect=n.arguments[0].getText(ast);ts.forEachChild(n,visit);}visit(fn);
function fixture(){
 const pending=[];const ctx={state:{loaded:false,loading:false},requestRef:{current:null},world:'events',runId:'run_1',fetch:()=>{},encodeURIComponent,AbortController,readGrowthEndpoint:(_f,_u,_k,c)=>new Promise(resolve=>pending.push({resolve,controller:c})),setState(v){ctx.state=typeof v==='function'?v(ctx.state):v;}};
 const code=ts.transpileModule(`globalThis.load=${load};globalThis.toggle=${toggle};globalThis.effect=${effect};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 vm.runInNewContext(code,ctx);const cleanup=ctx.effect();return{ctx,pending,cleanup};
}
test('actual diagnostics timeout leaves a retryable error rather than an endless loader',async()=>{
 const f=fixture();const done=f.ctx.load();f.pending[0].controller.abort();f.pending[0].resolve({ok:false,status:null,error:'body_timeout'});await done;
 assert.equal(f.ctx.state.loading,false);assert.equal(f.ctx.state.loaded,false);assert.ok(f.ctx.state.error);assert.equal(f.ctx.requestRef.current,null);
});
test('actual close cancels and prevents late data from replacing a reopened request',async()=>{
 const f=fixture();const old=f.ctx.load();f.ctx.toggle({currentTarget:{open:false}});assert.equal(f.pending[0].controller.signal.aborted,true);assert.equal(f.ctx.state.loading,false);
 const next=f.ctx.load();f.pending[0].resolve({ok:true,value:{diagnosticsAvailable:true,diagnostics:{before:999}}});await old;assert.equal(f.ctx.state.value,undefined);
 f.pending[1].resolve({ok:true,value:{diagnosticsAvailable:true,diagnostics:{before:12}}});await next;assert.equal(f.ctx.state.value.before,12);
});
test('actual unmount discards a late successful private diagnostic',async()=>{
 const f=fixture();const done=f.ctx.load();f.cleanup();f.pending[0].resolve({ok:true,value:{diagnosticsAvailable:true,diagnostics:{before:3}}});await done;assert.equal(f.ctx.state.value,undefined);assert.equal(f.ctx.requestRef.current,null);
});
