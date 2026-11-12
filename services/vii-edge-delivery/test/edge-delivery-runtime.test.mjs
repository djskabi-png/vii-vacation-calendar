import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';

function harness(originResponse, options = {}) {
  const entries = new Map(); let originCalls = 0; const writes = [];
  const oldFetch = globalThis.fetch; const oldCaches = globalThis.caches;
  globalThis.caches = { default: { async match(key) { if (options.neverMatch) return new Promise(() => {}); if (options.rejectMatch) throw new Error('cache_down'); return entries.get(key.url) || undefined; }, async put(key, response) { entries.set(key.url, response.clone()); writes.push(key.url); } } };
  globalThis.fetch = async (request) => { originCalls++; if (request.url.startsWith('https://vii-vacation-calendar')) return new Response(originResponse.body || '<html>ok</html>', { status: originResponse.status || 200, headers: originResponse.headers }); return new Response('passthrough', { status: 200 }); };
  return { ctx: { waitUntil(p) { return p; } }, stats: () => ({ originCalls, writes: [...writes], entries }), restore() { globalThis.fetch = oldFetch; globalThis.caches = oldCaches; } };
}

test('internal cache keeps the origin hard expiry while client freshness stays capped', async () => {
  const until = Date.now() + 600_000; const originHeaders = headers(); originHeaders.set('X-VII-Cache-Until', String(until)); const h = harness({ headers: originHeaders });
  try {
    const first = await worker.fetch(new Request('https://edge.test/search', { headers: { Accept: 'text/html' } }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const stored = [...h.stats().entries.values()][0]; assert.ok(Number(stored.headers.get('Cache-Control').match(/max-age=(\d+)/)[1]) > 60);
  } finally { h.restore(); }
});

const headers = () => new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'X-VII-Cache-Build': 'test-build', 'X-VII-Cache-Until': String(Date.now() + 60_000), 'Set-Cookie': '__cf_bm=infra; Path=/' });

test('delivery timing describes this lookup and distinguishes retained origin fill timing',async()=>{
 const originHeaders=headers();originHeaders.set('Server-Timing','vii-cache;dur=999, vii-edge-lookup;dur=8888, vii-edge-origin;dur=7777, app;desc="one,vii-edge-origin;dur=42"');originHeaders.set('X-VII-Cache-Read-Ms','999');const h=harness({headers:originHeaders});
 const env={ORIGIN:'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site',EXPECTED_BUILD:'test-build'};
 try{
 const first=await worker.fetch(new Request('https://edge.test/search',{headers:{Accept:'text/html'}}),env,h.ctx);
 assert.equal(first.headers.get('X-VII-Edge-Delivery'),'MISS');assert.equal(first.headers.get('X-VII-Edge-Origin-Attempts'),'1');assert.ok(Number.isFinite(Number(first.headers.get('X-VII-Edge-Origin-Ms'))));assert.match(first.headers.get('Server-Timing'),/vii-edge-origin;dur=/);
 await new Promise(resolve=>setTimeout(resolve,0));
 const hit=await worker.fetch(new Request('https://edge.test/search',{headers:{Accept:'text/html'}}),env,h.ctx);
 assert.equal(hit.headers.get('X-VII-Edge-Delivery'),'HIT');assert.equal(hit.headers.get('X-VII-Edge-Origin-Attempts'),'1');assert.equal(hit.headers.get('X-VII-Edge-Origin-Ms'),null);assert.match(hit.headers.get('X-VII-Edge-Lookup-Ms'),/^\d+$/);assert.match(hit.headers.get('Server-Timing'),/vii-cache;dur=999/);assert.match(hit.headers.get('Server-Timing'),/app;desc="one,vii-edge-origin;dur=42"/);assert.match(hit.headers.get('Server-Timing'),/vii-edge-lookup;dur=/);assert.doesNotMatch(hit.headers.get('Server-Timing'),/vii-edge-lookup;dur=8888/);assert.doesNotMatch(hit.headers.get('Server-Timing'),/vii-edge-origin;dur=7777/);assert.equal(hit.headers.get('X-VII-Cache-Read-Ms'),'999');assert.equal(h.stats().originCalls,1);
 }finally{h.restore();}
});

test('actual handler forwards infrastructure cookie on MISS and omits it on HIT', async () => {
  const h = harness({ headers: headers() });
  try {
    const first = await worker.fetch(new Request('https://edge.test/search', { headers: { Accept: 'text/html' } }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx);
    assert.equal(first.status, 200); assert.equal(first.headers.get('Set-Cookie'), '__cf_bm=infra; Path=/'); await new Promise((resolve) => setTimeout(resolve, 0));
    const second = await worker.fetch(new Request('https://edge.test/search', { headers: { Accept: 'text/html' } }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx);
    assert.equal(second.headers.get('X-VII-Edge-Delivery'), 'HIT'); assert.equal(second.headers.get('Set-Cookie'), null); assert.equal(h.stats().originCalls, 1);
  } finally { h.restore(); }
});

test('RSC cache identity ignores only the request-specific token and preserves router variants', async () => {
  const rscHeaders = headers();
  rscHeaders.set('Content-Type', 'text/x-component');
  const h = harness({ headers: rscHeaders, body: '<flight/>' });
  const env = { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' };
  const request = (token, tree = 'same-tree') => new Request(`https://edge.test/discover/place/spa-290.rsc?_rsc=${token}`, { headers: {
    Accept: 'text/x-component', RSC: '1', 'Next-Router-State-Tree': tree, 'X-Vinext-Interception-Context': '/spas',
  } });
  try {
    const first = await worker.fetch(request('first-token'), env, h.ctx);
    assert.equal(first.headers.get('X-VII-Edge-Delivery'), 'MISS');
    await new Promise(resolve => setTimeout(resolve, 0));
    const samePayload = await worker.fetch(request('different-token'), env, h.ctx);
    assert.equal(samePayload.headers.get('X-VII-Edge-Delivery'), 'HIT');
    const differentTree = await worker.fetch(request('third-token', 'different-tree'), env, h.ctx);
    assert.equal(differentTree.headers.get('X-VII-Edge-Delivery'), 'MISS');
    assert.equal(h.stats().originCalls, 2);
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

test('private requests on the public host preserve the public origin', async () => {
  const h = harness({ headers: headers() });
  const seen = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (request) => { seen.push(request.url); return new Response('passthrough', { status: 200 }); };
  try {
    await worker.fetch(new Request('https://vii.spaplus.co/account', { headers: { Accept: 'text/html', Cookie: 'session=x' } }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx);
    assert.equal(seen[0], 'https://vii.spaplus.co/account');
  } finally { globalThis.fetch = original; h.restore(); }
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

test('dated SPA package entry documents are cache-admitted and keep date and package variants distinct', async () => {
  const h = harness({ headers: headers() });
  const env = { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' };
  const request = (date, packageId) => new Request(`https://edge.test/discover/place/spa-25?date=${date}&package=${packageId}`, { headers: { Accept: 'text/html' } });
  try {
    const first = await worker.fetch(request('2026-11-13', '4193'), env, h.ctx);
    assert.equal(first.headers.get('X-VII-Edge-Delivery'), 'MISS');
    await new Promise(resolve => setTimeout(resolve, 0));
    const repeat = await worker.fetch(request('2026-11-13', '4193'), env, h.ctx);
    assert.equal(repeat.headers.get('X-VII-Edge-Delivery'), 'HIT');
    const anotherPackage = await worker.fetch(request('2026-11-13', '4194'), env, h.ctx);
    assert.equal(anotherPackage.headers.get('X-VII-Edge-Delivery'), 'MISS');
    const anotherDate = await worker.fetch(request('2026-11-14', '4193'), env, h.ctx);
    assert.equal(anotherDate.headers.get('X-VII-Edge-Delivery'), 'MISS');
    assert.equal(h.stats().originCalls, 3);
  } finally { h.restore(); }
});

test('dated SPA package entry qualifies the current app generic stream without admitting booking state', async () => {
  const originHeaders = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, must-revalidate',
    'X-VII-App-Build': 'test-build',
    'Set-Cookie': '__cf_bm=infra; Path=/',
  });
  const h = harness({ headers: originHeaders, body: '<html>dated package</html>' });
  const env = { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' };
  try {
    const url = 'https://edge.test/discover/place/spa-25?date=2026-11-13&package=4193';
    const first = await worker.fetch(new Request(url, { headers: { Accept: 'text/html' } }), env, h.ctx);
    assert.equal(first.headers.get('X-VII-Edge-Delivery'), 'MISS');
    assert.equal(first.headers.get('X-VII-Cache-Build'), 'test-build');
    await first.text(); await new Promise(resolve => setTimeout(resolve, 0));
    const second = await worker.fetch(new Request(url, { headers: { Accept: 'text/html' } }), env, h.ctx);
    assert.equal(second.headers.get('X-VII-Edge-Delivery'), 'HIT');
    assert.equal(h.stats().originCalls, 1);
    const booking = await worker.fetch(new Request(`${url}&booking=4193`, { headers: { Accept: 'text/html' } }), env, h.ctx);
    assert.equal(booking.headers.get('X-VII-Edge-Delivery'), null);
  } finally { h.restore(); }
});

test('catalog navigation hint is forwarded only on eligible regional Flight MISS and is never stored', async () => {
  const h = harness({ headers: headers() }); const seen = [];
  const original = globalThis.fetch;
  globalThis.fetch = async request => { seen.push(request); return new Response('<flight/>', { status: 200, headers: headers() }); };
  try {
    const response = await worker.fetch(new Request('https://edge.test/vacations/north.rsc', { headers: { Accept: 'text/x-component', RSC: '1', 'X-VII-Catalog-Navigation': 'search-v1' } }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx);
    assert.equal(response.headers.get('X-VII-Edge-Cache-Skip'), 'client_catalog_navigation');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(seen[0].headers.get('X-VII-Catalog-Navigation'), 'search-v1');
    assert.equal(h.stats().writes.length, 0);
  } finally { globalThis.fetch = original; h.restore(); }
});

test('invalid, prefetched, and ordinary regional requests keep the baseline path and cache identity', async () => {
  for (const [label, init] of [
    ['missing-hint', { Accept: 'text/x-component', RSC: '1' }],
    ['prefetch', { Accept: 'text/x-component', RSC: '1', 'X-VII-Catalog-Navigation': 'search-v1', 'Next-Router-Prefetch': '1' }],
    ['ordinary-html', { Accept: 'text/html', 'X-VII-Catalog-Navigation': 'search-v1' }],
  ]) {
    const h = harness({ headers: headers() }); const seen = []; const original = globalThis.fetch;
    globalThis.fetch = async request => { seen.push(request); return new Response('<ok/>', { status: 200, headers: headers() }); };
    try {
      const response = await worker.fetch(new Request('https://edge.test/vacations/north.rsc', { headers: init }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, h.ctx);
      assert.notEqual(response.headers.get('X-VII-Edge-Cache-Skip'), 'client_catalog_navigation', label);
      assert.notEqual(seen[0]?.headers.get('X-VII-Catalog-Navigation'), 'search-v1', label);
    } finally { globalThis.fetch = original; h.restore(); }
  }
});

test('ineligible hinted POST preserves body and auth while removing only the navigation hint', async () => {
  const seen = []; const oldFetch = globalThis.fetch;
  globalThis.fetch = async request => { seen.push(request); return new Response('ok', { status: 200 }); };
  try {
    const response = await worker.fetch(new Request('https://edge.test/account', { method: 'POST', headers: { 'Content-Type': 'text/plain', Authorization: 'Bearer test', 'X-VII-Catalog-Navigation': 'search-v1' }, body: 'payload' }), { ORIGIN: 'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site', EXPECTED_BUILD: 'test-build' }, { waitUntil() {} });
    assert.equal(response.status, 200); assert.equal(seen[0].headers.get('Authorization'), 'Bearer test'); assert.equal(seen[0].headers.get('X-VII-Catalog-Navigation'), null); assert.equal(await seen[0].text(), 'payload');
  } finally { globalThis.fetch = oldFetch; }
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

test('public-origin action and quote bypass retains method, origin, credentials and body without cache admission', async () => {
 const h=harness({headers:headers()});const old=globalThis.fetch;const seen=[];
 globalThis.fetch=async request=>{seen.push({url:request.url,method:request.method,origin:request.headers.get('Origin'),cookie:request.headers.get('Cookie'),action:request.headers.get('Next-Action'),body:await request.text()});return new Response('read-only-fixture',{status:200});};
 try {for(const path of ['/api/vii/stay-quote','/booking']) await worker.fetch(new Request('https://vii.spaplus.co'+path,{method:'POST',headers:{Origin:'https://vii.spaplus.co',Cookie:'session=synthetic', 'Next-Action':'synthetic-test', 'Content-Type':'application/json'},body:'{"fixture":true}'}),{ORIGIN:'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site',EXPECTED_BUILD:'test-build'},h.ctx);
 assert.equal(seen.length,2);for(const row of seen){assert.ok(row.url.startsWith('https://vii.spaplus.co/'));assert.equal(row.method,'POST');assert.equal(row.origin,'https://vii.spaplus.co');assert.equal(row.cookie,'session=synthetic');assert.equal(row.action,'synthetic-test');assert.equal(row.body,'{"fixture":true}');}assert.equal(h.stats().writes.length,0);
 } finally {globalThis.fetch=old;h.restore();}
});

test('real anonymous browsers carrying only Cloudflare infrastructure cookies still receive warm hits', async () => {
 const h=harness({headers:headers()});const old=globalThis.fetch;let calls=0;
 globalThis.fetch=async request=>{assert.equal(request.url,'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site/search');assert.equal(request.headers.get('Cookie'),null);calls++;return new Response('<html>public</html>',{headers:headers()});};
 try {const req=()=>new Request('https://vii.spaplus.co/search',{headers:{Accept:'text/html',Cookie:'__cf_bm=synthetic; cf_clearance=synthetic; '}});await worker.fetch(req(),{EXPECTED_BUILD:'test-build'},h.ctx);await new Promise(r=>setTimeout(r,0));const hit=await worker.fetch(req(),{EXPECTED_BUILD:'test-build'},h.ctx);assert.equal(hit.headers.get('X-VII-Edge-Delivery'),'HIT');assert.equal(hit.headers.get('Set-Cookie'),null);assert.equal(calls,1);
 } finally {globalThis.fetch=old;h.restore();}
});
test('a session mixed with infrastructure cookies remains uncached at the public origin', async () => {
 const h=harness({headers:headers()});const old=globalThis.fetch;
 globalThis.fetch=async request=>{assert.equal(request.url,'https://vii.spaplus.co/search');assert.ok(request.headers.get('Cookie').includes('session=private'));return new Response('private');};
 try{const r=await worker.fetch(new Request('https://vii.spaplus.co/search',{headers:{Accept:'text/html',Cookie:'__cf_bm=synthetic; session=private'}}),{},h.ctx);assert.equal(r.headers.get('X-VII-Edge-Delivery'),null);assert.equal(h.stats().writes.length,0);}finally{globalThis.fetch=old;h.restore();}
});

test('signed-in public shells fetch without viewer credentials and never cache identity', async () => {
 const h=harness({headers:headers()});const old=globalThis.fetch;const upstream=[];
 globalThis.fetch=async request=>{upstream.push({cookie:request.headers.get('Cookie'),identity:request.headers.get('X-Customer-Email'),url:request.url});return new Response('<html>anonymous public shell</html>',{headers:headers()});};
 try{for(const session of ['viewer-A','viewer-B']){const result=await worker.fetch(new Request('https://vii.spaplus.co/search',{headers:{Accept:'text/html',Cookie:'vii_admin_session='+session+'; __cf_bm=synthetic','X-Customer-Email':'private-fixture'}}),{EXPECTED_BUILD:'test-build'},h.ctx);assert.equal(await result.text(),'<html>anonymous public shell</html>');await new Promise(r=>setTimeout(r,0));}assert.equal(upstream.length,1);assert.equal(upstream[0].cookie,null);assert.equal(upstream[0].identity,null);assert.equal(upstream[0].url,'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site/search');
 }finally{globalThis.fetch=old;h.restore();}
});
test('recognized sessions stay intact on account APIs and action POSTs',async()=>{
 const h=harness({headers:headers()});const old=globalThis.fetch;const seen=[];
 globalThis.fetch=async request=>{seen.push({url:request.url,cookie:request.headers.get('Cookie'),method:request.method,body:await request.text()});return new Response('private');};
 try{for(const path of ['/api/account','/account','/booking','/admin']){await worker.fetch(new Request('https://vii.spaplus.co'+path,{headers:{Accept:'text/html',Cookie:'vii_customer_session=synthetic-private'}}),{},h.ctx);}await worker.fetch(new Request('https://vii.spaplus.co/search',{method:'POST',headers:{'Next-Action':'synthetic',Cookie:'vii_admin_session=private'},body:'private-action-fixture'}),{},h.ctx);assert.equal(seen.length,5);assert.ok(seen.slice(0,4).every(r=>r.cookie==='vii_customer_session=synthetic-private'));assert.equal(seen[4].cookie,'vii_admin_session=private');assert.equal(seen[4].body,'private-action-fixture');assert.equal(h.stats().writes.length,0);
 }finally{globalThis.fetch=old;h.restore();}
});
test('signed-in public RSC remains a separate anonymous routing variant',async()=>{
 const h=harness({headers:headers()});const old=globalThis.fetch;
 globalThis.fetch=async request=>{assert.equal(request.headers.get('Cookie'),null);assert.equal(request.headers.get('RSC'),'1');return new Response('public-flight',{headers:{'Content-Type':'text/x-component','X-VII-Cache-Build':'test-build','X-VII-Cache-Until':String(Date.now()+60000)}});};
 try{const r=await worker.fetch(new Request('https://vii.spaplus.co/search.rsc',{headers:{Accept:'text/x-component',RSC:'1',Cookie:'vii_customer_session=synthetic'}}),{EXPECTED_BUILD:'test-build'},h.ctx);assert.equal(r.headers.get('Content-Type'),'text/x-component');assert.equal(await r.text(),'public-flight');}finally{globalThis.fetch=old;h.restore();}
});

test('canonical and legacy redirects remain visible 301 responses instead of being followed inside the proxy',async()=>{
 const h=harness({headers:headers()});const old=globalThis.fetch;const target='https://vii.spaplus.co/vacations/search/karmiel?pool=1';
 globalThis.fetch=async request=>{assert.equal(request.redirect,'manual');return new Response(null,{status:301,headers:{Location:target}});};
 try{for(const path of ['/search?location=karmiel&pool=1','/s?attr=277']){const r=await worker.fetch(new Request('https://vii.spaplus.co'+path,{headers:{Accept:'text/html'}}),{},h.ctx);assert.equal(r.status,301);assert.equal(r.headers.get('Location'),target);}assert.equal(h.stats().writes.length,0);}finally{globalThis.fetch=old;h.restore();}
});

test('anonymous MISS avoids the public proxy hop while host-bound traffic and redirects retain their destination',async()=>{
 const h=harness({headers:headers()}),old=globalThis.fetch,seen=[];
 globalThis.fetch=async request=>{seen.push({url:request.url,cookie:request.headers.get('Cookie'),method:request.method});return new Response(null,{status:308,headers:{Location:'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site/events/search/north/lofts?guests=2#results'}});};
 try{
  const response=await worker.fetch(new Request('https://vii.spaplus.co/events/search/north?type=loft',{headers:{Accept:'text/html',Cookie:'vii_customer_session=private; cf_clearance=host-bound'}}),{EXPECTED_BUILD:'test-build'},h.ctx);
  assert.equal(seen[0].url,'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site/events/search/north?type=loft');assert.equal(seen[0].cookie,null);
  assert.equal(response.status,308);assert.equal(response.headers.get('Location'),'https://vii.spaplus.co/events/search/north/lofts?guests=2#results');assert.equal(h.stats().writes.length,0);
  await worker.fetch(new Request('https://vii.spaplus.co/account',{headers:{Accept:'text/html',Cookie:'vii_customer_session=private'}}),{EXPECTED_BUILD:'test-build'},h.ctx);
  assert.equal(seen[1].url,'https://vii.spaplus.co/account');assert.equal(seen[1].cookie,'vii_customer_session=private');
 }finally{globalThis.fetch=old;h.restore();}
});

test('a transient public GET500 gets exactly one changed retry while retaining complete dated party intent',async()=>{
 const h=harness({headers:headers()});const old=globalThis.fetch;const seen=[];const url='https://vii.spaplus.co/search?pool=1&from=2026-11-26&till=2026-11-28&guests=2&children=1&rooms=1';
 globalThis.fetch=async r=>{seen.push({url:r.url,cookie:r.headers.get('Cookie'),control:r.headers.get('Cache-Control')});return seen.length===1?new Response('transient',{status:500}):new Response('<html>verified public</html>',{headers:headers()});};
 try{const r=await worker.fetch(new Request(url,{headers:{Accept:'text/html',Cookie:'vii_admin_session=private'}}),{},h.ctx);assert.equal(r.status,200);assert.equal(r.headers.get('X-VII-Edge-Origin-Attempts'),'2');assert.equal(seen.length,2);assert.ok(seen.every(x=>x.url===url&&x.cookie===null));assert.equal(seen[1].control,'no-cache');}finally{globalThis.fetch=old;h.restore();}
});

test('single origin attempt is visible before a blocked body and preserves the stream',async()=>{
 const h=harness({headers:headers()}),old=globalThis.fetch;let release,timer,calls=0;
 const ready=new Promise(resolve=>{release=resolve;});
 globalThis.fetch=async()=>{calls++;return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('shell'));ready.then(()=>{controller.enqueue(new TextEncoder().encode('results'));controller.close();});}}),{headers:headers()});};
 try{
  const r=await Promise.race([worker.fetch(new Request('https://vii.spaplus.co/search',{headers:{Accept:'text/html'}}),{EXPECTED_BUILD:'test-build'},h.ctx),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('attempt diagnostic buffered the body')),1000);})]);
  assert.equal(r.headers.get('X-VII-Edge-Origin-Attempts'),'1');assert.equal(calls,1);release();assert.equal(await r.text(),'shellresults');
 }finally{clearTimeout(timer);release();globalThis.fetch=old;h.restore();}
});
test('repeated public failures stop after two attempts and private or transactional traffic never retries',async()=>{
 const h=harness({headers:headers()});const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('unavailable',{status:503});};
 try{const r=await worker.fetch(new Request('https://vii.spaplus.co/search',{headers:{Accept:'text/html'}}),{},h.ctx);assert.equal(r.status,503);assert.equal(calls,2);assert.equal(h.stats().writes.length,0);for(const request of [new Request('https://vii.spaplus.co/api/vii/stay-quote',{method:'POST',body:'{}'}),new Request('https://vii.spaplus.co/admin',{headers:{Cookie:'vii_admin_session=private'}}),new Request('https://vii.spaplus.co/search',{headers:{Authorization:'Bearer synthetic'}})]){calls=0;const excluded=await worker.fetch(request,{},h.ctx);assert.equal(calls,1);assert.equal(excluded.headers.get('X-VII-Edge-Origin-Attempts'),null);}}finally{globalThis.fetch=old;h.restore();}
});
test('one public network failure recovers but an explicit cancellation never retries',async()=>{
 const h=harness({headers:headers()});const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;if(calls===1)throw new TypeError('transient transport');return new Response('ok',{headers:headers()});};
 try{assert.equal((await worker.fetch(new Request('https://vii.spaplus.co/search',{headers:{Accept:'text/html'}}),{},h.ctx)).status,200);assert.equal(calls,2);calls=0;globalThis.fetch=async()=>{calls++;throw new DOMException('cancelled','AbortError');};await assert.rejects(worker.fetch(new Request('https://vii.spaplus.co/search',{headers:{Accept:'text/html'}}),{},h.ctx));assert.equal(calls,1);}finally{globalThis.fetch=old;h.restore();}
});

test('analytics-only visitors reuse the anonymous public shell without forwarding tracking or viewer identity', async()=>{
 const h=harness({headers:headers()}),seen=[];const originFetch=globalThis.fetch;
 globalThis.fetch=async request=>{seen.push({url:request.url,cookie:request.headers.get('Cookie')});return originFetch(request)};
 const env={ORIGIN:'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site',EXPECTED_BUILD:'test-build'};
 try{
  const first=await worker.fetch(new Request('https://edge.test/search',{headers:{Accept:'text/html',Cookie:'_ga=one; _ga_G123ABC=two; _gid=three; _gat_UA-123-1=four; _gcl_au=five; vii_customer_session=signed; __cf_bm=infra'}}),env,h.ctx);
  assert.equal(first.headers.get('X-VII-Edge-Delivery'),'MISS');assert.equal(seen[0].cookie,null);
  await new Promise(resolve=>setTimeout(resolve,0));
  for(const cookie of ['_ga=other','_ga_G123ABC=another','_gid=other','_gat=one','_gat_UA-123-1=other','_gcl_au=other']){
   const result=await worker.fetch(new Request('https://edge.test/search',{headers:{Accept:'text/html',Cookie:cookie}}),env,h.ctx);
   assert.equal(result.headers.get('X-VII-Edge-Delivery'),'HIT',cookie);
  }
  assert.equal(h.stats().originCalls,1);
 }finally{h.restore();}
});

test('analytics classification does not admit unknown cookies or forward private/API/action requests anonymously',async()=>{
 const h=harness({headers:headers()}),seen=[];const originFetch=globalThis.fetch;
 globalThis.fetch=async request=>{seen.push({url:request.url,cookie:request.headers.get('Cookie')});return originFetch(request)};
 const env={ORIGIN:'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site',EXPECTED_BUILD:'test-build'};
 try{
  for(const cookie of ['unknown=private; _ga=one','session=private; _ga=one','_gall=private','_ga_=private','_gcl_auth=private','malformed']){
   const result=await worker.fetch(new Request('https://edge.test/search',{headers:{Accept:'text/html',Cookie:cookie}}),env,h.ctx);assert.equal(result.headers.get('X-VII-Edge-Delivery'),null,cookie);
  }
  const cookie='vii_admin_session=signed; _ga=one';
  for(const [path,extra] of [['/admin',{}],['/api/auth/session',{}],['/booking',{}],['/search',{'Next-Action':'action'}],['/account',{}]]){
   const result=await worker.fetch(new Request('https://vii.spaplus.co'+path,{headers:{Accept:'text/html',Cookie:cookie,...extra}}),env,h.ctx);assert.equal(result.headers.get('X-VII-Edge-Delivery'),null,path);assert.equal(seen.at(-1).cookie,cookie,path);
  }
  assert.equal(h.stats().writes.length,0);
 }finally{h.restore();}
});

test('an origin analytics Set-Cookie header still blocks shared response admission',async()=>{
 const responseHeaders=headers();responseHeaders.set('Set-Cookie','_ga=from-server; Path=/');const h=harness({headers:responseHeaders});
 try{const response=await worker.fetch(new Request('https://edge.test/search',{headers:{Accept:'text/html',Cookie:'_ga=existing'}}),{ORIGIN:'https://vii-vacation-calendar.adir-naor-7510.chatgpt.site',EXPECTED_BUILD:'test-build'},h.ctx);assert.equal(response.headers.get('X-VII-Edge-Cache-Skip'),'set_cookie');assert.equal(h.stats().writes.length,0);}finally{h.restore();}
});
