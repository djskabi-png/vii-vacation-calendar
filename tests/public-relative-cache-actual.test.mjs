import test from 'node:test';
import assert from 'node:assert/strict';
import edge from '../services/vii-edge-delivery/src/index.ts';
import { publicCachePolicy, storePublicCache } from '../worker/public-response-cache.ts';

const base = 'https://edge.test';
const build = 'relative-cache-actual';
const env = { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: build };
function context() {
  const pending = [];
  return { waitUntil(p) { pending.push(p); }, async settle() { while (pending.length) await Promise.allSettled(pending.splice(0)); } };
}
function harness() {
  const oldFetch = globalThis.fetch, oldCaches = globalThis.caches;
  const entries = new Map(); let calls = 0;
  globalThis.caches = { default: {
    async match(key) { return entries.get(key.url)?.clone(); },
    async put(key, response) { entries.set(key.url, response.clone()); },
  } };
  globalThis.fetch = async request => {
    calls++;
    const policy = await publicCachePolicy(request, new URL(request.url), build);
    const type = request.url.includes('.rsc') ? 'text/x-component' : 'text/html';
    const response = new Response(`content-${calls}`, { headers: { 'Content-Type': type, 'Cache-Control': 'no-store, must-revalidate' } });
    const ctx = context();
    const result = storePublicCache(response, policy, undefined, ctx);
    await ctx.settle(); return result;
  };
  return { entries, calls: () => calls, restore() { globalThis.fetch = oldFetch; globalThis.caches = oldCaches; } };
}
function request(path, rsc = false) {
  return new Request(base + path, { headers: rsc
    ? { Accept: 'text/x-component', RSC: '1', 'X-Vinext-Interception-Context': '/' }
    : { Accept: 'text/html' } });
}

test('actual origin and outer handlers cache missing landing families in HTML and Flight', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-07T13:00:00Z') });
  const h = harness();
  try {
    for (const path of ['/last-minute', '/weekend/friday-to-sunday', '/zimmers', '/suites', '/hospitality-complexes', '/en/last-minute']) {
      for (const rsc of [false, true]) {
        const req = request(path + (rsc ? '.rsc?_rsc=exact' : ''), rsc);
        const ctx = context(); const calls = h.calls();
        const first = await edge.fetch(req, env, ctx); await first.text(); await ctx.settle();
        assert.equal(first.headers.get('X-VII-Edge-Delivery'), 'MISS', req.url);
        const hit = await edge.fetch(req, env, ctx);
        assert.equal(hit.headers.get('X-VII-Edge-Delivery'), 'HIT', req.url);
        assert.equal(h.calls(), calls + 1);
      }
    }
  } finally { h.restore(); }
});

test('both layers partition relative HTML and Flight at exact Israel cutoff and midnight', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-07T11:59:59.500Z') });
  const h = harness();
  try {
    for (const [before, after] of [
      ['2026-11-07T11:59:59.500Z', '2026-11-07T12:00:00Z'],
      ['2026-11-07T21:59:59.500Z', '2026-11-07T22:00:00Z'],
    ]) {
      for (const path of ['/', '/last-minute', '/weekend/thursday-night', '/holidays', '/events', '/spas', '/fr/spas']) {
        for (const rsc of [false, true]) {
          t.mock.timers.setTime(Date.parse(before));
          const req = request(path + (rsc ? '.rsc?_rsc=boundary' : ''), rsc);
          const p = await publicCachePolicy(req, new URL(req.url), build);
          assert.equal(p.expiresAt, Date.parse(after));
          const ctx = context(); const initial = await edge.fetch(req, env, ctx); await initial.text(); await ctx.settle();
          assert.equal(initial.headers.get('X-VII-Cache-Until'), String(Date.parse(after)));
          assert.match(initial.headers.get('Cache-Control'), /max-age=0(?:,|$)/);
          t.mock.timers.setTime(Date.parse(after));
          const nextPolicy = await publicCachePolicy(req, new URL(req.url), build);
          assert.notEqual(nextPolicy.key, p.key);
          const calls = h.calls(); const next = await edge.fetch(req, env, ctx); await next.text(); await ctx.settle();
          assert.equal(next.headers.get('X-VII-Edge-Delivery'), 'MISS');
          assert.equal(h.calls(), calls + 1);
        }
      }
    }
  } finally { h.restore(); }
});

test('render finishing after its captured cutoff is not admitted with a restarted lifetime', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-07T11:59:59Z') });
  const req = request('/last-minute');
  const p = await publicCachePolicy(req, new URL(req.url), build);
  t.mock.timers.setTime(Date.parse('2026-11-07T12:00:01Z'));
  const ctx = context();
  const result = storePublicCache(new Response('late', { headers: { 'Content-Type': 'text/html' } }), p, undefined, ctx);
  assert.equal(result.headers.get('X-VII-Cache-Until'), null);
  assert.equal(result.headers.get('X-VII-Page-Cache'), null);
  await ctx.settle();
});
