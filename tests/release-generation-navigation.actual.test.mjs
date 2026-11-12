import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogNavigationFetch } from '../app/lib/catalog-navigation-fetch.ts';

function storageFixture() {
  const values = new Map();
  return {
    values,
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  };
}

test('matching RSC generation remains a normal client navigation', async () => {
  const replaced = [], fixture = storageFixture();
  const fetch = catalogNavigationFetch(async () => new Response('flight', { headers: { 'Content-Type': 'text/x-component', 'X-VII-App-Build': 'build-a' } }), 'https://vii.test', () => false, {
    clientBuild: 'build-a', storage: fixture.storage, replace: href => replaced.push(href), now: () => 100_000,
  });
  const response = await fetch('https://vii.test/events?_rsc=abc', { headers: { RSC: '1' } });
  assert.equal(await response.text(), 'flight');
  assert.deepEqual(replaced, []);
});

test('newer RSC generation replaces the route document once before parsing', async () => {
  const replaced = [], fixture = storageFixture();
  const fetch = catalogNavigationFetch(async () => new Response('incompatible-flight', { headers: { 'Content-Type': 'text/x-component', 'X-VII-App-Build': 'build-b' } }), 'https://vii.test', () => false, {
    clientBuild: 'build-a', storage: fixture.storage, replace: href => replaced.push(href), now: () => 100_000,
  });
  void fetch('https://vii.test/events?_rsc=abc', { headers: { RSC: '1' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(replaced, ['https://vii.test/events']);
  assert.equal(fixture.values.size, 1);
});

test('release recovery never replays actions, APIs, external requests or loops', async () => {
  const replaced = [], fixture = storageFixture();
  let now = 100_000;
  const original = async () => new Response('response', { headers: { 'Content-Type': 'text/x-component', 'X-VII-App-Build': 'build-b' } });
  const fetch = catalogNavigationFetch(original, 'https://vii.test', () => false, {
    clientBuild: 'build-a', storage: fixture.storage, replace: href => replaced.push(href), now: () => now,
  });
  assert.equal(await (await fetch('https://vii.test/events', { method: 'POST', headers: { RSC: '1' } })).text(), 'response');
  assert.equal(await (await fetch('https://other.test/events', { headers: { RSC: '1' } })).text(), 'response');
  void fetch('https://vii.test/spas?_rsc=one', { headers: { RSC: '1' } });
  await new Promise(resolve => setImmediate(resolve));
  void fetch('https://vii.test/spas?_rsc=two', { headers: { RSC: '1' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(replaced, ['https://vii.test/spas']);
});

test('all primary world routes share the same release boundary', async () => {
  for (const path of ['/events', '/spas', '/hourly', '/vacations/north']) {
    const replaced = [], fixture = storageFixture();
    const fetch = catalogNavigationFetch(async () => new Response('flight', { headers: { 'Content-Type': 'text/x-component', 'X-VII-Cache-Build': 'next' } }), 'https://vii.test', () => false, {
      clientBuild: 'current', storage: fixture.storage, replace: href => replaced.push(href), now: () => 100_000,
    });
    void fetch(`https://vii.test${path}?_rsc=x`, { headers: { Accept: 'text/x-component' } });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(replaced, [`https://vii.test${path}`]);
  }
});
