import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
test('local candidate preview permits only the two read-only quote POST handlers',()=>{
 const source=readFileSync(new URL('../scripts/preview-built-candidate.mjs',import.meta.url),'utf8');
 const match=source.match(/const quoteReadPaths = new Set\((\[[^;]+\])\)/);assert.ok(match);assert.deepEqual(JSON.parse(match[1]),['/api/vii/stay-quote','/api/vii/stay-unit-quotes']);
 assert.match(source,/request\.method !== "GET" && request\.method !== "HEAD" && !quoteRead/);
 assert.match(source,/bytes > 65_536/);assert.doesNotMatch(source,/request\.headers\.cookie|Authorization:/);
});
