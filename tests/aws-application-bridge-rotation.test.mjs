import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const bridge = require('../infrastructure/aws/application-bridge/index.cjs');

function fakeClient(connect) {
  return {
    connect,
    endCalls: 0,
    async end() { this.endCalls += 1; },
  };
}

test.beforeEach(() => bridge.__test.invalidateCredentials());

test('secret cache is reused before its five-minute expiry', async () => {
  let loads = 0;
  const loadSecret = async () => ({ username: 'vii', password: `secret-${++loads}` });
  const first = await bridge.__test.credentials({ loadSecret, now: 1_000 });
  const second = await bridge.__test.credentials({ loadSecret, now: 299_999 });
  assert.equal(first.password, 'secret-1');
  assert.equal(second.password, 'secret-1');
  assert.equal(loads, 1);
});

test('expired cache fetches the current RDS-managed secret', async () => {
  let loads = 0;
  const loadSecret = async () => ({ username: 'vii', password: `secret-${++loads}` });
  await bridge.__test.credentials({ loadSecret, now: 1_000 });
  const refreshed = await bridge.__test.credentials({ loadSecret, now: 301_001 });
  assert.equal(refreshed.password, 'secret-2');
  assert.equal(loads, 2);
});

test('invalid-password connection refreshes the secret once before any SQL', async () => {
  let loads = 0;
  const clients = [];
  const loadSecret = async () => ({ username: 'vii', password: `secret-${++loads}` });
  const createClient = secret => {
    const client = fakeClient(async () => {
      if (secret.password === 'secret-1') throw Object.assign(new Error('stale password'), { code: '28P01' });
    });
    clients.push({ client, secret });
    return client;
  };
  const connected = await bridge.__test.connectedClient({ loadSecret, createClient, now: 1_000 });
  assert.equal(connected, clients[1].client);
  assert.deepEqual(clients.map(item => item.secret.password), ['secret-1', 'secret-2']);
  assert.equal(loads, 2);
  assert.equal(clients[0].client.endCalls, 1);
});

test('network failures do not cause a pointless credential retry', async () => {
  let loads = 0;
  const loadSecret = async () => ({ username: 'vii', password: `secret-${++loads}` });
  const client = fakeClient(async () => { throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }); });
  await assert.rejects(() => bridge.__test.connectedClient({ loadSecret, createClient: () => client, now: 1_000 }), error => {
    assert.equal(error.code, 'ETIMEDOUT');
    assert.equal(error.bridgeStage, 'connect');
    return true;
  });
  assert.equal(loads, 1);
  assert.equal(client.endCalls, 1);
});

test('second authentication failure stops after one safe refresh', async () => {
  let loads = 0;
  const loadSecret = async () => ({ username: 'vii', password: `secret-${++loads}` });
  const clients = [];
  const createClient = () => {
    const client = fakeClient(async () => { throw Object.assign(new Error('invalid password'), { code: '28P01' }); });
    clients.push(client);
    return client;
  };
  await assert.rejects(() => bridge.__test.connectedClient({ loadSecret, createClient, now: 1_000 }), error => {
    assert.equal(error.bridgeStage, 'connect_after_secret_refresh');
    return true;
  });
  assert.equal(loads, 2);
  assert.equal(clients.length, 2);
  assert.equal(clients[0].endCalls, 1);
  assert.equal(clients[1].endCalls, 1);
});

test('worker preserves a route-provided data-origin header', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../worker/index.ts', import.meta.url), 'utf8'));
  assert.match(source, /if \(!response\.headers\.has\("X-VII-Data-Origin"\)\)/);
  assert.match(source, /response\.headers\.set\("X-VII-Data-Origin", awsDatabaseMode\(env\)\)/);
});
