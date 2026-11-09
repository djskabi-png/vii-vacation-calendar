import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import ts from "typescript";
import * as identity from '../app/lib/gallery-media-identity.ts';

const source = await fs.readFile(new URL("../app/api/vii/media/[filename]/route.ts", import.meta.url), "utf8");
const buildRoute = ({ object = null, error = false, recovery = null, catalogRecovery = null, catalogError = false } = {}) => {
  const calls = [];
  const originCalls = [];
  const bucket = { async get(key) { calls.push(key); if(error) throw Error('storage'); return object; } };
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(name => {
    if(name.endsWith('legacy-gallery-media.json')) return { default: { files: [], objectPrefix: 'legacy-gallery/v1/' } };
    if(name.endsWith('legacy-gallery-storage')) return { legacyGalleryBucket: async () => bucket };
    if(name.endsWith('gallery-media-identity.ts')) return identity;
    if(name === 'cloudflare:workers') return { env: { ASSETS: { fetch() { throw Error('unexpected direct asset fetch'); } } } };
    if(name.endsWith('verified-media-recovery.ts')) return { recoverVerifiedGalleryMedia: async () => recovery };
    if(name.endsWith('catalog-media-origin-recovery.ts')) return { recoverCatalogMedia: async (request, filename, env) => {
      originCalls.push({ method: request.method, filename, bucket: env.UPLOADS });
      if(catalogError) throw Error('catalog unavailable');
      return catalogRecovery;
    } };
    throw Error('Unexpected route dependency: '+name);
  }, module, module.exports);
  return {...module.exports, calls, originCalls};
};
const context = (filename, method = "GET") => ({ params: Promise.resolve({ filename }), request: new Request(`https://vii.spaplus.co/api/vii/media/${filename}`, { method }) });

test("actual route serves a safe R2 object even when absent from stale manifest", async () => {
  const route = buildRoute({ object: { body: new ReadableStream(), httpMetadata: { contentType: "image/jpeg" }, httpEtag: "x" } });
  const response = await route.GET(new Request("https://x"), context("new-asset.jpg"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/jpeg");
  assert.deepEqual(route.calls, ['legacy-gallery/v1/new-asset.jpg']);
  assert.equal(route.originCalls.length, 0, 'existing images never require a catalog/source lookup');
});

test("actual route returns 404 for absent object and invalid names", async () => {
  const route = buildRoute();
  assert.equal((await route.GET(new Request("https://x"), context("missing.jpg"))).status, 404);
  assert.equal((await route.GET(new Request("https://x"), context("../secret.jpg"))).status, 404);
  assert.equal((await route.GET(new Request("https://x"), context("page.html"))).status, 404);
  assert.deepEqual(route.calls, ['legacy-gallery/v1/missing.jpg'], 'invalid names must never touch storage');
});

test("actual route rejects stored non-image objects for GET and HEAD", async () => {
  const route = buildRoute({ object: { body: new ReadableStream(), httpMetadata: { contentType: "application/json" } } });
  assert.equal((await route.GET(new Request("https://x"), context("fake.jpg"))).status, 404);
  const head = await route.HEAD(new Request("https://x", { method: "HEAD" }), context("fake.jpg", "HEAD"));
  assert.equal(head.status, 404);
  assert.equal(await head.text(), "");
  assert.equal(route.originCalls.length, 0, 'verified static recovery has priority');
});

test('catalog-authorized recovery is shared by the real GET and HEAD route', async () => {
  const response = () => new Response(null, { status:200, headers:{'Content-Type':'image/jpeg','X-VII-Media':'catalog-imported'} });
  for(const method of ['GET','HEAD']) {
    const route = buildRoute({ catalogRecovery:response() });
    const result = await route[method](new Request('https://x',{method}),context('accepted-new.jpg',method));
    assert.equal(result.status,200);assert.equal(result.headers.get('X-VII-Media'),'catalog-imported');
    assert.deepEqual(route.originCalls.map(({method,filename})=>({method,filename})),[{method,filename:'accepted-new.jpg'}]);
  }
});

test('failed catalog authorization lookup stays unavailable without inventing media', async () => {
  const route=buildRoute({catalogError:true});
  const result=await route.GET(new Request('https://x'),context('accepted-new.jpg'));
  assert.equal(result.status,503);assert.equal(result.headers.get('Cache-Control'),'no-store');
});

test("actual route returns 503 on storage failure", async () => {
  const route = buildRoute({ error: true });
  assert.equal((await route.GET(new Request("https://x"), context("asset.jpg"))).status, 503);
});

test("actual route preserves verified recovery response and empty HEAD body", async () => {
  const recovery = new Response(null, { status: 200, headers: { "Content-Type": "image/jpeg", "X-VII-Media": "recovered" } });
  const route = buildRoute({ recovery });
  const head = await route.HEAD(new Request("https://x", { method: "HEAD" }), context("verified.jpg", "HEAD"));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});
