import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('official static header input survives build and scopes MIME rules to verified local WOFF2 files',async()=>{
 const source=await readFile(new URL('../public/_headers',import.meta.url),'utf8');
 const built=await readFile(new URL('../dist/client/_headers',import.meta.url),'utf8');
 assert.equal(built,source);
 const paths=source.split(/\r?\n/).filter(line=>line.startsWith('/'));
 const fontPaths=['heebo/heebo-hebrew-v28.woff2','heebo/heebo-latin-v28.woff2',...['arabic','cyrillic-ext','cyrillic','hebrew','latin-ext','latin'].map(subset=>'rubik/rubik-'+subset+'-v31.woff2')];
 assert.deepEqual(paths,['/assets/*',...fontPaths.map(name=>'/fonts/'+name)]);
 assert.match(source,/\/assets\/\*\r?\n  Cache-Control: public, max-age=31536000, immutable/);
 for(const name of fontPaths){
  assert.ok(source.replaceAll('\r\n','\n').includes('/fonts/'+name+'\n  Content-Type: font/woff2'));
  const original=await readFile(new URL('../public/fonts/'+name,import.meta.url));
  const copied=await readFile(new URL('../dist/client/fonts/'+name,import.meta.url));
  assert.equal(original.subarray(0,4).toString(),'wOF2');
  assert.deepEqual(copied,original);
 }
 assert.doesNotMatch(source,/Access-Control|Set-Cookie|Content-Security|noindex/);
});
