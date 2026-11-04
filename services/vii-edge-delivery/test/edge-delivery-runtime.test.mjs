import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';

function harness(originResponse, options = {}) {
  const entries = new Map(); let originCalls = 0; const writes = [];
  const oldFetch = globalThis.fetch; const oldCaches = globalThis.caches;
  globalThis.caches = { default: { async match(key) { if (options.neverMatch) return new Promise(() => {}); if (options.rejectMatch) throw new Error('cache_down'); return entries.get(key.url) || undefined; }, async put(key, response) { entries.set(key.url, response.clone()); writes.push(key.url); } } };
  globalThis.fetch = async (request) => { originCalls++; if (request.url.startsWith('https://vii-vacation-calendar')) return new Response(originResponse.body || '<html>ok</html>', { status: originResponse.status || 200, headers: originResponse.headers }); return new Response('passthrough', { status: 200 }); };
  return { ctx: { waitUntil(p) { return p; } }, stats: () => ({ originCalls, writes: [...writes] }), restore() { globalThis.fetch = oldFetch; globalThis.caches = oldCaches; } };
}

const headers = () => new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'X-VII-Cache-Build': 'test-build', 'X-VII-Cache-Until': String(Date.now() + 60_000), 'Set-Cookie': '__cf_bm=infra; Path=/' });

test('actual handler forwards infrastructure cookie on MISS and omits it on HIT', async () => {
  const h = harness({ headers: headers() });
  try {
    const first = await worker.fetch(new Request('https://edge.test/search', { headers: { Accept: 'text/html' } }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx);
    assert.equal(first.status, 200); assert.equal(first.headers.get('Set-Cookie'), '__cf_bm=infra; Path=/'); await new Promise((resolve) => setTimeout(resolve, 0));
    const second = await worker.fetch(new Request('https://edge.test/search', { headers: { Accept: 'text/html' } }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx);
    assert.equal(second.headers.get('X-VII-Edge-Delivery'), 'HIT'); assert.equal(second.headers.get('Set-Cookie'), null); assert.equal(h.stats().originCalls, 1);
  } finally { h.restore(); }
});

test('actual handler bypasses private, action, API and unknown-query requests', async () => {
  const h = harness({ headers: headers() });
  try {
    for (const [path, init] of [['/search', { Accept: 'text/html', Cookie: 'session=x' }], ['/search', { Accept: 'text/html', 'Next-Action': 'x' }], ['/api/catalog?world=spa', { Accept: 'application/json' }], ['/search?unknown=x', { Accept: 'text/html' }]]) {
      const response = await worker.fetch(new Request(`https://edge.test${path}`, { headers: init }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx);
      assert.equal(response.headers.get('X-VII-Edge-Delivery'), null);
    }
    assert.equal(h.stats().writes.length, 0);
  } finally { h.restore(); }
});

test('actual handler blocks unknown Set-Cookie from admission', async () => {
  const h = harness({ headers: new Headers({ 'Content-Type': 'text/html', 'X-VII-Cache-Build': 'test-build', 'X-VII-Cache-Until': String(Date.now() + 60_000), 'Set-Cookie': 'session=private; Path=/' }) });
  try { const response = await worker.fetch(new Request('https://edge.test/search', { headers: { Accept: 'text/html' } }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx); assert.equal(response.headers.get('X-VII-Edge-Cache-Skip'), 'set_cookie'); assert.equal(h.stats().writes.length, 0); } finally { h.restore(); }
});

test('actual handler rejects no-store, unsupported vary and oversize responses', async () => {
  for (const [label, path, extra, body] of [['no-store', '/search', { 'Cache-Control': 'no-store' }, '<html>x</html>'], ['vary', '/events', { Vary: 'User-Agent' }, '<html>x</html>'], ['oversize', '/spas', { 'Content-Length': String(3 * 1024 * 1024) }, '<html>x</html>']]) {
    const base = headers(); for (const [key, value] of Object.entries(extra)) base.set(key, value);
    const h = harness({ headers: base, body });
    try { const response = await worker.fetch(new Request(`https://edge.test${path}`, { headers: { Accept: 'text/html' } }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx); assert.equal(response.headers.get('X-VII-Edge-Cache-Skip') !== null, true, label); assert.equal(h.stats().writes.length, 0); } finally { h.restore(); }
  }
});

test('actual handler separates build/query variants and does not cache an expired response', async () => {
  const h = harness({ headers: headers() });
  try {
    const base = { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' };
    const a = await worker.fetch(new Request('https://edge.test/search?pool=1', { headers: { Accept: 'text/html' } }), base, h.ctx); assert.equal(a.status, 200); await new Promise((resolve) => setTimeout(resolve, 0));
    const b = await worker.fetch(new Request('https://edge.test/search?pool=2', { headers: { Accept: 'text/html' } }), base, h.ctx); assert.equal(b.headers.get('X-VII-Edge-Delivery'), 'MISS');
    const expired = headers(); expired.set('X-VII-Cache-Until', String(Date.now() - 1)); const he = harness({ headers: expired });
    try { const e = await worker.fetch(new Request('https://edge.test/events', { headers: { Accept: 'text/html' } }), base, he.ctx); assert.equal(e.headers.get('X-VII-Edge-Cache-Skip'), 'missing_expiry'); assert.equal(he.stats().writes.length, 0); } finally { he.restore(); }
  } finally { h.restore(); }
});

test('actual handler returns origin failure and never stores it', async () => {
  const h = harness({ headers: headers() }); const original = globalThis.fetch;
  globalThis.fetch = async (request) => { if (request.url.startsWith('https://vii-vacation-calendar')) throw new Error('origin_down'); return original(request); };
  try { await assert.rejects(() => worker.fetch(new Request('https://edge.test/search', { headers: { Accept: 'text/html' } }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx), /origin_down/); assert.equal(h.stats().writes.length, 0); } finally { h.restore(); }
});

test('actual handler fails closed on duplicate keys and unknown tracking keys', async () => {
  const h = harness({ headers: headers() });
  try {
    for (const path of ['/search?id=a&id=b', '/search?id=b&id=a', '/search?utm_unknown=x']) {
      const response = await worker.fetch(new Request(`https://edge.test${path}`, { headers: { Accept: 'text/html' } }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx);
      assert.equal(response.headers.get('X-VII-Edge-Delivery'), null);
    }
    assert.equal(h.stats().writes.length, 0);
  } finally { h.restore(); }
});

test('actual handler accepts known locale prefixes without collapsing their cache identity', async () => {
  const h = harness({ headers: headers() });
  try {
    for (const path of ['/en/search', '/fr/search']) {
      const response = await worker.fetch(new Request(`https://edge.test${path}`, { headers: { Accept: 'text/html' } }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx);
      assert.equal(response.status, 200); assert.equal(response.headers.get('X-VII-Edge-Delivery'), 'MISS');
    }
  } finally { h.restore(); }
});

test('actual handler bounds cache-match failures and never serves expired HITs', async () => {
  const stalled = harness({ headers: headers() }, { neverMatch: true }); const base = { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' };
  try { const started = Date.now(); const response = await worker.fetch(new Request('https://edge.test/search', { headers: { Accept: 'text/html' } }), base, stalled.ctx); assert.ok(Date.now() - started < 1000); assert.equal(response.status, 200); } finally { stalled.restore(); }
  const expiredHeaders = headers(); expiredHeaders.set('X-VII-Cache-Until', String(Date.now() - 1)); const expired = harness({ headers: expiredHeaders });
  try { const response = await worker.fetch(new Request('https://edge.test/search', { headers: { Accept: 'text/html' } }), base, expired.ctx); assert.equal(response.status, 200); assert.equal(expired.stats().originCalls, 1); } finally { expired.restore(); }
});
