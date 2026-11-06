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
 assert.equal(first.headers.get('X-VII-Edge-Delivery'),'MISS');assert.ok(Number.isFinite(Number(first.headers.get('X-VII-Edge-Origin-Ms'))));assert.match(first.headers.get('Server-Timing'),/vii-edge-origin;dur=/);
 await new Promise(resolve=>setTimeout(resolve,0));
 const hit=await worker.fetch(new Request('https://edge.test/search',{headers:{Accept:'text/html'}}),env,h.ctx);
 assert.equal(hit.headers.get('X-VII-Edge-Delivery'),'HIT');assert.equal(hit.headers.get('X-VII-Edge-Origin-Ms'),null);assert.match(hit.headers.get('X-VII-Edge-Lookup-Ms'),/^\d+$/);assert.match(hit.headers.get('Server-Timing'),/vii-cache;dur=999/);assert.match(hit.headers.get('Server-Timing'),/app;desc="one,vii-edge-origin;dur=42"/);assert.match(hit.headers.get('Server-Timing'),/vii-edge-lookup;dur=/);assert.doesNotMatch(hit.headers.get('Server-Timing'),/vii-edge-lookup;dur=8888/);assert.doesNotMatch(hit.headers.get('Server-Timing'),/vii-edge-origin;dur=7777/);assert.equal(hit.headers.get('X-VII-Cache-Read-Ms'),'999');assert.equal(h.stats().originCalls,1);
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
 globalThis.fetch=async request=>{assert.equal(request.url,'https://vii.spaplus.co/search');calls++;return new Response('<html>public</html>',{headers:headers()});};
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
 try{for(const session of ['viewer-A','viewer-B']){const result=await worker.fetch(new Request('https://vii.spaplus.co/search',{headers:{Accept:'text/html',Cookie:'vii_admin_session='+session+'; __cf_bm=synthetic','X-Customer-Email':'private-fixture'}}),{EXPECTED_BUILD:'test-build'},h.ctx);assert.equal(await result.text(),'<html>anonymous public shell</html>');await new Promise(r=>setTimeout(r,0));}assert.equal(upstream.length,1);assert.equal(upstream[0].cookie,'__cf_bm=synthetic');assert.equal(upstream[0].identity,null);assert.equal(upstream[0].url,'https://vii.spaplus.co/search');
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

test('a transient public GET500 gets exactly one changed retry while retaining complete dated party intent',async()=>{
 const h=harness({headers:headers()});const old=globalThis.fetch;const seen=[];const url='https://vii.spaplus.co/search?pool=1&from=2026-11-26&till=2026-11-28&guests=2&children=1&rooms=1';
 globalThis.fetch=async r=>{seen.push({url:r.url,cookie:r.headers.get('Cookie'),control:r.headers.get('Cache-Control')});return seen.length===1?new Response('transient',{status:500}):new Response('<html>verified public</html>',{headers:headers()});};
 try{const r=await worker.fetch(new Request(url,{headers:{Accept:'text/html',Cookie:'vii_admin_session=private'}}),{},h.ctx);assert.equal(r.status,200);assert.equal(seen.length,2);assert.ok(seen.every(x=>x.url===url&&x.cookie===null));assert.equal(seen[1].control,'no-cache');}finally{globalThis.fetch=old;h.restore();}
});
test('repeated public failures stop after two attempts and private or transactional traffic never retries',async()=>{
 const h=harness({headers:headers()});const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('unavailable',{status:503});};
 try{const r=await worker.fetch(new Request('https://vii.spaplus.co/search',{headers:{Accept:'text/html'}}),{},h.ctx);assert.equal(r.status,503);assert.equal(calls,2);assert.equal(h.stats().writes.length,0);for(const request of [new Request('https://vii.spaplus.co/api/vii/stay-quote',{method:'POST',body:'{}'}),new Request('https://vii.spaplus.co/admin',{headers:{Cookie:'vii_admin_session=private'}}),new Request('https://vii.spaplus.co/search',{headers:{Authorization:'Bearer synthetic'}})]){calls=0;await worker.fetch(request,{},h.ctx);assert.equal(calls,1);}}finally{globalThis.fetch=old;h.restore();}
});
test('one public network failure recovers but an explicit cancellation never retries',async()=>{
 const h=harness({headers:headers()});const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;if(calls===1)throw new TypeError('transient transport');return new Response('ok',{headers:headers()});};
 try{assert.equal((await worker.fetch(new Request('https://vii.spaplus.co/search',{headers:{Accept:'text/html'}}),{},h.ctx)).status,200);assert.equal(calls,2);calls=0;globalThis.fetch=async()=>{calls++;throw new DOMException('cancelled','AbortError');};await assert.rejects(worker.fetch(new Request('https://vii.spaplus.co/search',{headers:{Accept:'text/html'}}),{},h.ctx));assert.equal(calls,1);}finally{globalThis.fetch=old;h.restore();}
});
