import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('official static header input survives build and only changes the two verified WOFF2 MIME types',async()=>{
 const source=await readFile(new URL('../public/_headers',import.meta.url),'utf8');
 const built=await readFile(new URL('../dist/client/_headers',import.meta.url),'utf8');
 assert.equal(built,source);
 const paths=source.split(/\r?\n/).filter(line=>line.startsWith('/'));
 assert.deepEqual(paths,['/assets/*','/fonts/heebo/heebo-hebrew-v28.woff2','/fonts/heebo/heebo-latin-v28.woff2']);
 assert.match(source,/\/assets\/\*\r?\n  Cache-Control: public, max-age=31536000, immutable/);
 for(const name of ['heebo-hebrew-v28.woff2','heebo-latin-v28.woff2']){
  assert.ok(source.replaceAll('\r\n','\n').includes('/fonts/heebo/'+name+'\n  Content-Type: font/woff2'));
  const original=await readFile(new URL('../public/fonts/heebo/'+name,import.meta.url));
  const copied=await readFile(new URL('../dist/client/fonts/heebo/'+name,import.meta.url));
  assert.equal(original.subarray(0,4).toString(),'wOF2');
  assert.deepEqual(copied,original);
 }
 assert.doesNotMatch(source,/Access-Control|Set-Cookie|Content-Security|noindex/);
});
