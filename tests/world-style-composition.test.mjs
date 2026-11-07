import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { composeWorldStyles, worldStyleSources } from '../build/world-style-slots.mjs';

test('world source isolation preserves every byte of the frozen effective cascade after newline normalization',()=>{
  const sources=worldStyleSources();
  const css=fs.readFileSync('app/globals.css','utf8');
  assert.ok(css.startsWith('@import "./public-fonts.css";'));
  // The only deliberate global change is the audited, self-hosted equivalent font.
  // Preserve byte-for-byte verification of every original world/cascade rule.
  const originalFontImport='@import url("https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap");';
  const actual=composeWorldStyles(css.replace('@import "./public-fonts.css";',originalFontImport),sources).replace(/\r\n/g,'\n');
  const expected='26c269af41b60dde130dd053ac486e7896eaf34cf68b2035af1afb7bde56ef9f';
  assert.equal(sources.manifest.baselineSource,'81f03b74022e01fabe433381bc1fbd9b2d0e23e0');
  assert.equal(createHash('sha256').update(actual).digest('hex'),expected);
  assert.deepEqual(new Set(sources.manifest.slots.map(s=>s.world)),new Set(['spa','events','hourly','vacations']));
  assert.equal(sources.files.size,4);
  assert.equal(sources.slots.size,882);
});
test('missing, duplicate and unknown slots block the build instead of silently dropping CSS',()=>{
  const sources=worldStyleSources(),original=fs.readFileSync('app/globals.css','utf8'),marker=[...sources.slots.keys()][0];
  assert.throws(()=>composeWorldStyles(original.replace(marker,''),sources),/Missing/);
  assert.throws(()=>composeWorldStyles(original+marker,sources),/duplicate/);
  assert.throws(()=>composeWorldStyles(original+'/* VII_WORLD_STYLE_UNKNOWN_001 */',sources),/Unknown/);
});
