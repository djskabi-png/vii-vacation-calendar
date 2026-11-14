import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
test('local candidate preview permits only the bounded read-only POST handlers used by visual QA',()=>{
 const source=readFileSync(new URL('../scripts/preview-built-candidate.mjs',import.meta.url),'utf8');
 const match=source.match(/const readPostPaths = new Set\((\[[^;]+\])\)/);assert.ok(match);assert.deepEqual(JSON.parse(match[1]),['/api/vii/stay-quote','/api/vii/stay-unit-quotes','/api/vii/card-galleries','/api/vii/live-search']);
 assert.match(source,/request\.method !== "GET" && request\.method !== "HEAD" && !readPost/);
 assert.match(source,/bytes > 65_536/);assert.doesNotMatch(source,/request\.headers\.cookie|Authorization:/);
});
