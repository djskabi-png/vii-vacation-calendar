import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import ts from 'typescript';
const source=readFileSync(new URL('../app/lib/world-availability.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const requestReadsSource=readFileSync(new URL('../app/lib/server-request-reads.ts',import.meta.url),'utf8');
const requestReadsJs=ts.transpileModule(requestReadsSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const hostRequire=createRequire(import.meta.url);
function harness(){let now=0,enabled=0,fail=false;const calls=[],exports={},requestReads={};
 const db={prepare(sql){let args;calls.push(sql);return{bind(...values){args=values;return this;},async all(){if(fail)throw Error('offline');return{results:[{world:'events',enabled}]};},async run(){enabled=args[1];return{meta:{changes:1}};}};},async batch(statements){calls.push('schema-batch');return statements.map(()=>({meta:{changes:1}}));}};
 vm.runInNewContext(requestReadsJs,{exports:requestReads,module:{exports:requestReads},require:hostRequire});
 vm.runInNewContext(js,{exports,module:{exports},require(name){if(name.includes('runtime-database'))return{requiredRuntimeDatabase:async()=>db};if(name.includes('server-request-reads'))return requestReads;return hostRequire(name);},Date:class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}});
 return{api:exports,calls,advance(value){now+=value;},fail(){fail=true;}};
}
test('actual cold public availability reads only SELECT and respects disabled worlds and15second cache',async()=>{
 const h=harness();assert.equal((await h.api.readWorldAvailability()).events,false);assert.equal(h.calls.length,1);assert.match(h.calls[0],/^SELECT /);await h.api.readWorldAvailability();assert.equal(h.calls.length,1);h.advance(15001);await h.api.readWorldAvailability();assert.equal(h.calls.length,2);assert.ok(h.calls.every(sql=>sql.startsWith('SELECT')));
});
test('actual failed public read preserves existing fallback without schema writes or automatic retry',async()=>{
 const h=harness();h.fail();const result=await h.api.readWorldAvailability();assert.equal(result.events,true);assert.equal(h.calls.length,1);assert.match(h.calls[0],/^SELECT /);
});
test('actual admin save still ensures schema, persists disabled state and invalidates the public cache',async()=>{
 const h=harness();await h.api.readWorldAvailability();const saved=await h.api.setWorldAvailability('events',false,'quality');assert.equal(saved.events,false);assert.ok(h.calls.some(sql=>sql.includes('CREATE TABLE IF NOT EXISTS')));assert.ok(h.calls.some(sql=>sql.includes('CREATE INDEX IF NOT EXISTS')));assert.ok(h.calls.some(sql=>sql.includes('ON CONFLICT(world)')));assert.equal(h.calls.filter(sql=>sql.startsWith('SELECT')).length,2);assert.equal((await h.api.readWorldAvailability()).events,false);assert.equal(h.calls.filter(sql=>sql.startsWith('SELECT')).length,2);
});
