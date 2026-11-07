import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('actual React catalog transition preserves content and urgent input within a bounded runner', {timeout:50000}, () => {
  const runner=fileURLToPath(new URL('./helpers/published-catalog-transition-runner.mjs',import.meta.url));
  const result=spawnSync(process.execPath,['--test',runner],{cwd:process.cwd(),env:Object.fromEntries(Object.entries(process.env).filter(([name])=>!name.startsWith('NODE_TEST_'))),windowsHide:true,encoding:'utf8',timeout:45000,maxBuffer:1024*1024});
  assert.equal(result.status,0, [result.error?.message,result.stdout,result.stderr].filter(Boolean).join('\n'));
  assert.match(result.stdout,/pass 2/);
});
