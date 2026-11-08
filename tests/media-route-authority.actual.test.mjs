import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import ts from "typescript";
import * as identity from '../app/lib/gallery-media-identity.ts';

const source = await fs.readFile(new URL("../app/api/vii/media/[filename]/route.ts", import.meta.url), "utf8");
const buildRoute = ({ object = null, error = false, recovery = null } = {}) => {
  const calls = [];
  const bucket = { async get(key) { calls.push(key); if(error) throw Error('storage'); return object; } };
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(name => {
    if(name.endsWith('legacy-gallery-media.json')) return { default: { files: [], objectPrefix: 'legacy-gallery/v1/' } };
    if(name.endsWith('legacy-gallery-storage')) return { legacyGalleryBucket: async () => bucket };
    if(name.endsWith('gallery-media-identity.ts')) return identity;
    if(name === 'cloudflare:workers') return { env: { ASSETS: { fetch() { throw Error('unexpected direct asset fetch'); } } } };
    if(name.endsWith('verified-media-recovery.ts')) return { recoverVerifiedGalleryMedia: async () => recovery };
    throw Error('Unexpected route dependency: '+name);
  }, module, module.exports);
  return {...module.exports, calls};
};
const context = (filename, method = "GET") => ({ params: Promise.resolve({ filename }), request: new Request(`https://vii.spaplus.co/api/vii/media/${filename}`, { method }) });

test("actual route serves a safe R2 object even when absent from stale manifest", async () => {
  const route = buildRoute({ object: { body: new ReadableStream(), httpMetadata: { contentType: "image/jpeg" }, httpEtag: "x" } });
  const response = await route.GET(new Request("https://x"), context("new-asset.jpg"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/jpeg");
  assert.deepEqual(route.calls, ['legacy-gallery/v1/new-asset.jpg']);
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
