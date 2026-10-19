import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { validOnlineCapabilities } from '../app/lib/online-booking-capability.ts';

function harness() {
  const source = readFileSync(new URL('../app/lib/use-online-capabilities.ts', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/^"use client";/, '');
  const compiled = stripTypeScriptTypes(source, { mode: 'strip' }).replace('export function useOnlineCapabilities', 'function useOnlineCapabilities');
  let state, effect, refresh, next, calls = 0;
  const hook = new Function('useState','useEffect','validOnlineCapabilities','fetch','window',`${compiled};return useOnlineCapabilities;`)(
    initial => { state ??= initial; return [state, value => { state = typeof value === 'function' ? value(state) : value; }]; },
    callback => { effect = callback; }, validOnlineCapabilities,
    async (_url, init) => { calls++; assert.ok(init.signal instanceof AbortSignal); return typeof next === 'function' ? next() : next; },
    { setInterval(callback) { refresh = callback; return 1; }, clearInterval() {} },
  );
  return { hook, run() { return effect(); }, refresh() { refresh(); }, get state() { return state; }, get calls() { return calls; }, set next(value) { next = value; } };
}
const settle = async () => { for (let n = 0; n < 24; n++) await Promise.resolve(); };

test('actual hook loads bounded capability once and reuses it on interval/remount', async () => {
  const h = harness(); const capabilities = { 'vacation-1': { checkedAt: Date.now() } };
  h.next = Response.json({ capabilities });
  assert.equal(h.hook(true).status, 'loading'); const cleanup = h.run(); await settle();
  assert.deepEqual(h.state, { status: 'ready', capabilities });
  h.refresh(); await settle(); assert.equal(h.calls, 1); cleanup();
});
test('actual cold failure exits loading and exposes an error, without invented results', async () => {
  for (const response of [new Response('', { status: 503 }), Response.json({ capabilities: { 'event-1': { checkedAt: Date.now() } } }), Response.json({})]) {
    const h = harness(); h.next = response; h.hook(true); const cleanup = h.run(); await settle();
    assert.deepEqual(h.state, { status: 'error', capabilities: {} }); cleanup();
  }
});
test('late response after unmount cannot update hook state', async () => {
  const h = harness(); let release; h.next = () => new Promise(resolve => { release = resolve; });
  h.hook(true); const cleanup = h.run(); cleanup(); release(Response.json({ capabilities: {} })); await settle();
  assert.equal(h.state.status, 'loading');
});
