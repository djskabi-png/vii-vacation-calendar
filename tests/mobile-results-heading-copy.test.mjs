import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('mobile event count and description stack without altering count-and-filter toolbars or desktop',()=>{
  const css=readFileSync(new URL('../app/mobile-polish.css',import.meta.url),'utf8');
  const rule='.site-page .results-heading__meta:has(> p + p)';
  assert.ok(css.indexOf(rule)>css.indexOf('@media (max-width:760px)'));
  assert.match(css,/\.results-heading__meta:has\(> p \+ p\) \{ display:grid; gap:4px; \}/);
});
