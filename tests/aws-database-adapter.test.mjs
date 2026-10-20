import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseForEnv, awsDatabaseMode } from '../app/lib/aws-database.ts';

test('AWS adapter preserves D1 read, write and mixed batch semantics without exposing the token', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    const operations = requests.at(-1).operations;
    return Response.json({ok:true,results:operations.map((operation,index)=>({
      success:true,
      results:operation.method === 'all' || operation.method === 'first' ? [{value:index+1}] : [],
      raw:operation.method === 'raw' ? [[index+1]] : undefined,
      meta:{changes:operation.method === 'run' ? 1 : 0},
    }))});
  };
  try {
    const fallback = {prepare(){ throw new Error('D1 fallback must not be used'); }};
    const env = {DB:fallback,VII_AWS_DB_ENDPOINT:'https://bridge.example.test',VII_AWS_DB_TOKEN:'private-token',VII_AWS_DB_MODE:'primary'};
    const db = databaseForEnv(env);
    assert.equal(awsDatabaseMode(env),'aws-aurora');
    assert.deepEqual((await db.prepare('SELECT ? AS value').bind(7).all()).results,[{value:1}]);
    assert.deepEqual(await db.prepare('SELECT ? AS value').bind(8).first(),{value:1});
    assert.deepEqual(await db.prepare('SELECT ? AS value').bind(9).raw(),[[1]]);
    assert.equal((await db.prepare('UPDATE x SET y=?').bind(1).run()).meta.changes,1);
    const batch = await db.batch([
      db.prepare('SELECT 1'),
      db.prepare('INSERT INTO x VALUES (?)').bind('a'),
    ]);
    assert.deepEqual(batch.map(result=>result.results),[[{value:1}],[{value:2}]]);
    assert.deepEqual(requests.at(-1).operations.map(operation=>operation.method),['all','all']);
    assert.equal(JSON.stringify(requests).includes('private-token'),false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AWS adapter leaves the original D1 binding active unless primary mode is complete', () => {
  const fallback = {prepare(){}};
  assert.equal(databaseForEnv({DB:fallback,VII_AWS_DB_MODE:'primary'}),fallback);
  assert.equal(databaseForEnv({DB:fallback,VII_AWS_DB_ENDPOINT:'https://bridge.example.test',VII_AWS_DB_TOKEN:'token'}),fallback);
});
