import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { readQualityScopeOptions, selectManualQualityChecks, qualityRegistry } from '../app/lib/quality-platform.ts';
import { adaptQualityChecks, qualityScopeMetadata, selectQualityScope } from '../app/lib/quality-check-scope.ts';

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
  const source=readFileSync(new URL('../app/admin/quality/page.tsx',import.meta.url),'utf8');
  const ast=ts.createSourceFile('quality.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let initializer;
  const visit=node=>{ if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='runNow') initializer=node.initializer.getText(ast); ts.forEachChild(node,visit); };
  visit(ast); assert.ok(initializer);
  const code=ts.transpileModule(`return (${initializer});`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function(...Object.keys(dependencies),code)(...Object.values(dependencies));
}

test('actual UI retry preserves original scope, level and idempotency key after uncertain delivery', async () => {
  const bodies=[],jobKey={current:null}; let calls=0;
  const shared={running:false,activeRun:null,jobRunning:false,scopePlan:{supported:true},jobKey,crypto,AbortSignal,
    setRunning(){},setError(){},setJob(){},sessionStorage:{setItem(){}},load:async()=>{},
    fetch:async(_url,input)=>{bodies.push(JSON.parse(input.body));if(++calls===1)throw Error('uncertain network outcome');return Response.json({job:{runId:'durable-job',status:'queued'}},{status:202});},
  };
  await actualRunNow({...shared,scopeBox:'maps',level:'full'})();
  assert.ok(jobKey.current);
  await actualRunNow({...shared,scopeBox:'spa',level:'regular'})();
  assert.deepEqual(bodies[1],bodies[0]);
  assert.deepEqual(bodies[1].scope,{changedBoxes:['maps']});
});

test('actual UI blocks unsupported scope before enqueue and releases key after definitive validation refusal', async () => {
  let calls=0;const jobKey={current:null};
  const shared={running:false,activeRun:null,jobRunning:false,jobKey,crypto,AbortSignal,scopeBox:'maps',level:'regular',
    setRunning(){},setError(){},setJob(){},sessionStorage:{setItem(){}},load:async()=>{},fetch:async()=>{calls++;return Response.json({error:'quality_scope_level_incomplete'},{status:400});},
  };
  await actualRunNow({...shared,scopePlan:{supported:false}})();assert.equal(calls,0);
  await actualRunNow({...shared,scopePlan:{supported:true}})();assert.equal(calls,1);assert.equal(jobKey.current,null);
});
