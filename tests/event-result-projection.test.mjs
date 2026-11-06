import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {readSupplierCatalogSelectedSummariesPinned} from '../app/lib/supplier-catalog-store.ts';

function database(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('CREATE TABLE supplier_catalog_entries(run_id TEXT, world TEXT, supplier_id INTEGER, summary_json TEXT, PRIMARY KEY(run_id,world,supplier_id)); CREATE TABLE supplier_catalog_state(world TEXT PRIMARY KEY, active_run_id TEXT);');
 const insert=sqlite.prepare('INSERT INTO supplier_catalog_entries VALUES(?,?,?,?)');
 const places=Array.from({length:1000},(_,i)=>({supplierId:i+1,slug:`event-${i+1}`,name:`Venue ${i+1}`,image:'/real.jpg',description:'Supplier content'}));
 sqlite.exec('BEGIN');for(const p of places)for(const run of ['old:accepted','new:accepted'])insert.run(run,'events',p.supplierId,JSON.stringify({...p,name:run+':'+p.supplierId}));sqlite.exec('COMMIT');
 sqlite.prepare('INSERT INTO supplier_catalog_state VALUES(?,?)').run('events','old:accepted');
 const calls=[];let afterQuery=()=>{};
 const db={prepare(sql){let values=[];return{bind(...args){assert.ok(args.length<=100,'D1 bind budget');values=args;return this;},async all(){calls.push({sql,values});const results=sqlite.prepare(sql).all(...values);afterQuery(calls.length);return{success:true,results};}};}};
 return{sqlite,db,calls,places,afterQuery(fn){afterQuery=fn;},close(){sqlite.close();}};
}
test('actual SQLite selected read preserves 40/100 IDs without full/detail reads and pins generation during rotation',async()=>{
 const f=database();try{
  let rows=await readSupplierCatalogSelectedSummariesPinned(f.db,'events','old:accepted',Array.from({length:40},(_,i)=>i+1));
  assert.equal(rows.length,40);assert.equal(f.calls.length,1);assert.equal(f.calls[0].values.length,42);
  f.calls.length=0;f.afterQuery(n=>{if(n===1)f.sqlite.prepare('UPDATE supplier_catalog_state SET active_run_id=?').run('new:accepted');});
  rows=await readSupplierCatalogSelectedSummariesPinned(f.db,'events','old:accepted',Array.from({length:100},(_,i)=>i+1));
  assert.equal(rows.length,100);assert.equal(f.calls.length,2);assert.ok(f.calls.every(c=>c.values[0]==='old:accepted'&&!c.sql.includes('detail_json')));assert.ok(rows.every(p=>p.name.startsWith('old:accepted:')));
  f.sqlite.prepare('DELETE FROM supplier_catalog_entries WHERE run_id=? AND supplier_id=?').run('old:accepted',17);
  rows=await readSupplierCatalogSelectedSummariesPinned(f.db,'events','old:accepted',[17,18,18,NaN,-1]);assert.deepEqual(rows.map(p=>p.supplierId),[18]);
  await assert.rejects(readSupplierCatalogSelectedSummariesPinned(f.db,'events','old:accepted',Array.from({length:101},(_,i)=>i+1)),/projection_invalid/);
 }finally{f.close();}
});

function resultReader(dependencies){
 const source=readFileSync(new URL('../app/lib/public-catalog-read.ts',import.meta.url),'utf8');
 const ast=ts.createSourceFile('reader.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const names=new Set(['publicEventResultSummaries','withEditorialOverlays','applyEditorial','catalogIdentity']);
 const functions=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)).map(n=>n.getText(ast).replace(/^export /,'')).join('\n');
 const code=ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 return new Function(...Object.keys(dependencies),code+'\nreturn publicEventResultSummaries;')(...Object.values(dependencies));
}
test('actual result projection keeps editorial edits and accepted removals fresh without a full-world projection',async()=>{
 const f=database();let title='Editorial one',stateReads=0,overlayReads=0,projectionRows=0;
 try{
  const read=resultReader({publicCatalogDatabase:async()=>({database:f.db}),readPublishedItems:async(_db,type)=>{assert.equal(type,'events');overlayReads++;return[{key:'1',content:{title,summary:'Edited summary'}}];},readSupplierCatalogState:async()=>{stateReads++;return{activeRunId:f.sqlite.prepare('SELECT active_run_id FROM supplier_catalog_state').get().active_run_id};},readSupplierCatalogSelectedSummariesPinned,bundled:()=>f.places,publicSummaries:async(_world,entries)=>{projectionRows+=entries.length;return entries;},console:{warn(){}}});
  const ids=Array.from({length:40},(_,i)=>i+1);
  let rows=await read(ids);assert.equal(rows.length,40);assert.equal(rows.find(p=>p.supplierId===1).name,'Editorial one');assert.equal(projectionRows,40);
  title='Editorial two';f.sqlite.prepare('DELETE FROM supplier_catalog_entries WHERE run_id=? AND supplier_id=?').run('old:accepted',17);
  rows=await read(ids);assert.equal(rows.length,39);assert.equal(rows.find(p=>p.supplierId===1).name,'Editorial two');assert.equal(rows.some(p=>p.supplierId===17),false);assert.equal(stateReads,2);assert.equal(overlayReads,2);assert.equal(projectionRows,79);
  await assert.rejects(read(Array.from({length:101},(_,i)=>i+1)),/projection_limit/);
 }finally{f.close();}
});
test('no accepted generation and unavailable database retain only the requested bundled identities',async()=>{
 const entries=[{supplierId:1,name:'One'},{supplierId:2,name:'Two'}];
 const dependencies={publicCatalogDatabase:async()=>({database:{}}),readPublishedItems:async()=>[],readSupplierCatalogState:async()=>null,readSupplierCatalogSelectedSummariesPinned:async()=>{throw Error('must not run');},bundled:()=>entries,publicSummaries:async(_world,rows)=>rows,console:{warn(){}}};
 assert.deepEqual(await resultReader(dependencies)([2]),[entries[1]]);
 dependencies.publicCatalogDatabase=async()=>{throw Error('unavailable');};assert.deepEqual(await resultReader(dependencies)([1]),[entries[0]]);
});
