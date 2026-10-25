import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { default as worker } from '../dist/server/index.js';

const pages = ['/', '/spas', '/hourly', '/events/search', '/search', '/providers', '/attractions', '/discover/place/spa-193', '/en/spas', '/ru/hourly', '/fr/attractions'];
const env = { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } };
const rows = [];
for (const path of pages) {
  for (const navigation of [false, true]) {
    const route = navigation ? `${path === '/' ? '/' : path}.rsc?_rsc` : path;
    const headers = { Accept: navigation ? 'text/x-component' : 'text/html', Cookie: '__cf_bm=qa' };
    if (navigation) headers.RSC = '1';
    let expected;
    for (const warm of [false, true]) {
      const pending = [];
      const start = performance.now();
      const response = await worker.fetch(new Request(`https://vii.spaplus.co${route}`, { headers }), env, { waitUntil(p) { pending.push(p); }, passThroughOnException() {} });
      const bytes = await response.arrayBuffer();
      const elapsedMs = Number((performance.now() - start).toFixed(2));
      await Promise.all(pending);
      const hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get('Content-Type'), navigation ? /text\/x-component/ : /text\/html/);
      const cache = response.headers.get(navigation ? 'X-VII-Navigation-Cache' : 'X-VII-Page-Cache');
      if (warm) { assert.equal(cache, 'HIT', route); assert.equal(hash, expected, `content changed on cache hit: ${route}`); }
      else expected = hash;
      rows.push({ route, warm, elapsedMs, bytes: bytes.byteLength, cache, layer: response.headers.get('X-VII-Cache-Layer') });
    }
    const pending = [];
    const privateResponse = await worker.fetch(new Request(`https://vii.spaplus.co${route}`, { headers: { ...headers, Cookie: 'vii_customer_session=invalid-probe' } }), env, { waitUntil(p) { pending.push(p); }, passThroughOnException() {} });
    assert.equal(privateResponse.headers.get('X-VII-Page-Cache'), null);
    assert.equal(privateResponse.headers.get('X-VII-Navigation-Cache'), null);
    await privateResponse.arrayBuffer(); await Promise.all(pending);
  }
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), rows, verdict: 'passed' }, null, 2));
