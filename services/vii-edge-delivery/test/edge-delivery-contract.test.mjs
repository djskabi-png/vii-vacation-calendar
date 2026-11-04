import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
test('edge cache is fail-closed for private and transactional requests', () => {
  assert.match(source, /Authorization/); assert.match(source, /Cookie/); assert.match(source, /Next-Action/); assert.match(source, /\/api\//); assert.match(source, /booking/);
});
test('cache identity includes build and request variants', () => { assert.match(source, /__build/); assert.match(source, /__variants/); assert.match(source, /variantHeaders/); });
test('response admission protects privacy, expiry, vary and size', () => {
  for (const guard of ['Set-Cookie', 'private_or_no_store', 'vary', 'missing_expiry', 'oversize', 'maxBytes']) assert.match(source, new RegExp(guard.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
test('only documented infrastructure cookies may be stripped from the stored copy', () => {
  assert.match(source, /infrastructureCookies/); assert.match(source, /infrastructureSetCookieOnly/); assert.match(source, /headers\.delete\("Set-Cookie"\)/);
  assert.match(source, /const clientHeaders = new Headers\(response\.headers\)/);
});
