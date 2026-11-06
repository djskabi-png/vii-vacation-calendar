import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { readQualityScopeOptions, selectManualQualityChecks, qualityRegistry } from '../app/lib/quality-platform.ts';
import { adaptQualityChecks, qualityScopeMetadata, selectQualityScope } from '../app/lib/quality-check-scope.ts';
import {readQualityJobIntent,persistQualityJobIntent,clearQualityJobIntent} from '../app/lib/quality-job-intent.ts';

test('scope options preserve full dependency coverage or explicitly reject the level', () => {
  const options = readQualityScopeOptions();
  for (const box of options.boxes) {
    const expected=selectQualityScope(adaptQualityChecks(qualityRegistry,qualityScopeMetadata),[box]);
    assert.equal(expected.status,'selected');
    for (const level of ['regular','medium','full']) {
      const plan=options.scopes[box][level];
      if (plan.supported) assert.deepEqual([...plan.checkIds].sort(),[...expected.selectedCheckIds].sort());
      else assert.throws(()=>selectManualQualityChecks(level,{changedBoxes:[box]}),/quality_scope_level_incomplete/);
    }
  }
  assert.equal(options.scopes.maps.regular.supported,false);
  assert.equal(options.scopes.maps.full.supported,true);
  assert.throws(()=>selectManualQualityChecks('full',{changedBoxes:['unknown']}),/quality_scope_unmapped/);
  for (const check of qualityRegistry) assert.equal(options.metadata[check.checkId].costBudgetMs,check.timeoutMs);
});

function actualRunNow(dependencies) {
  dependencies={readQualityJobIntent,persistQualityJobIntent,clearQualityJobIntent,setRestoredBrowserProfileId(){},...dependencies};
  const source=readFileSync(new URL('../app/admin/quality/page.tsx',import.meta.url),'utf8');
  const ast=ts.createSourceFile('quality.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let initializer;
  const visit=node=>{ if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='runNow') initializer=node.initializer.getText(ast); ts.forEachChild(node,visit); };
  visit(ast); assert.ok(initializer);
  const code=ts.transpileModule(`return (${initializer});`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function(...Object.keys(dependencies),code)(...Object.values(dependencies));
}

test('actual UI retry preserves original scope, level and idempotency key after uncertain delivery', async () => {
  const bodies=[],jobKey={current:null},stored=new Map(); let calls=0;
  const shared={running:false,activeRun:null,jobRunning:false,scopePlan:{supported:true},jobKey,crypto,AbortSignal,
    setRunning(){},setError(){},setJob(){},sessionStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},load:async()=>{},
    fetch:async(_url,input)=>{bodies.push(JSON.parse(input.body));if(++calls===1)throw Error('uncertain network outcome');return Response.json({job:{runId:'durable-job',status:'queued'}},{status:202});},
  };
  await actualRunNow({...shared,scopeBox:'maps',level:'full'})();
  assert.ok(jobKey.current);
  // A remount loses the ref but retains the durable browser intent.
  await actualRunNow({...shared,jobKey:{current:null},scopeBox:'spa',level:'regular'})();
  assert.deepEqual(bodies[1],bodies[0]);
  assert.deepEqual(bodies[1].scope,{changedBoxes:['maps']});
});

test('actual UI blocks unsupported scope before enqueue and releases key after definitive validation refusal', async () => {
  let calls=0;const jobKey={current:null};
  const stored=new Map();const shared={running:false,activeRun:null,jobRunning:false,jobKey,crypto,AbortSignal,scopeBox:'maps',level:'regular',
    setRunning(){},setError(){},setJob(){},sessionStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},load:async()=>{},fetch:async()=>{calls++;return Response.json({error:'quality_scope_level_incomplete'},{status:400});},
  };
  await actualRunNow({...shared,scopePlan:{supported:false}})();assert.equal(calls,0);
  await actualRunNow({...shared,scopePlan:{supported:true}})();assert.equal(calls,1);assert.equal(jobKey.current,null);
});

test('actual UI does not send a new request when its durable intent cannot be retained',async()=>{
  let calls=0;const errors=[];
  await actualRunNow({running:false,activeRun:null,jobRunning:false,jobKey:{current:null},crypto,AbortSignal,
    scopeBox:'maps',scopePlan:{supported:true},level:'full',setRunning(){},setError:value=>errors.push(value),
    sessionStorage:{getItem:()=>null,setItem(){throw Error('storage blocked')},removeItem(){}},
    fetch:async()=>{calls++;throw Error('must not send')},setJob(){},load:async()=>{},
  })();
  assert.equal(calls,0);assert.ok(errors.some(value=>value.includes('לא נשלחה בקשת הפעלה חדשה')));
});

test('a browser intent survives remount, a changed selector and an unverified authority response',async()=>{
 const stored=new Map(),bodies=[];let calls=0;
 const dependencies={running:false,activeRun:null,jobRunning:false,scopePlan:{supported:true},crypto,AbortSignal,scopeBox:'maps',level:'full',setRunning(){},setError(){},setJob(){},load:async()=>{},sessionStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},fetch:async(_url,input)=>{bodies.push(JSON.parse(input.body));calls++;if(calls===1)throw Error('uncertain');return calls===2?Response.json({error:'old_authority'},{status:400}):Response.json({job:{runId:'accepted-browser-job',status:'queued'}},{status:202});}};
 await actualRunNow({...dependencies,jobKey:{current:null}})('vacations-mobile-gallery-next');
 const first=readQualityJobIntent(dependencies.sessionStorage);assert.equal(first.browserProfileId,'vacations-mobile-gallery-next');assert.equal(first.scope,undefined);
 await actualRunNow({...dependencies,level:'regular',scopeBox:'spa',jobKey:{current:null}})('spa-desktop-world-shell');
 assert.deepEqual(readQualityJobIntent(dependencies.sessionStorage),first);
 await actualRunNow({...dependencies,jobKey:{current:null}})();
 assert.deepEqual(bodies[0],{action:'enqueue-browser',profileId:first.browserProfileId,idempotencyKey:first.key});assert.deepEqual(bodies[1],bodies[0]);assert.deepEqual(bodies[2],bodies[0]);assert.equal(readQualityJobIntent(dependencies.sessionStorage),null);
});
