import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { composeWorldStyles, worldStyleSources } from '../build/world-style-slots.mjs';

test('world source isolation preserves every byte of the frozen effective cascade after newline normalization',()=>{
  const sources=worldStyleSources();
  const css=fs.readFileSync('app/globals.css','utf8');
  assert.ok(css.startsWith('@import "./public-fonts.css";'));
  // Reverse only the two explicitly audited shared changes before comparing
  // the original cascade. All unrelated world styles must remain byte exact.
  const originalFontImport='@import url("https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700;800&display=swap");';
  const mapFix='.listing-map-shell.single-map,\n.discovery-location .listing-map-shell.single-map { height: 300px; min-height: 300px; }\n.listing-map-shell.single-map .listing-map { height: 100%; min-height: 0; }';
  const oldMap='.listing-map-shell.single-map, .listing-map-shell.single-map .listing-map { min-height: 300px; }';
  const normalized=css.replace(/\r\n/g,'\n');
  assert.equal(normalized.split(mapFix).length,2,'the precise audited map repair is present once');
  const spaGroups='.spa-results__landing-links > .spa-results__filter-group { display: grid; gap: 7px; grid-template-columns: 1fr; }\n.spa-results__filter-group > strong { color: var(--ink-soft); font-size: .72rem; font-weight: 850; }\n.spa-results__filter-group > div { display: grid; grid-template-columns: repeat(5,minmax(72px,1fr)); gap: 8px; }\n';
  assert.equal(normalized.split(spaGroups).length,2,'the precise audited SPA filter-group addition is present once');
  const unitAdditions=[
    '.room-card__image-button { position:absolute; inset:0; width:100%; height:100%; padding:0; border:0; background:transparent; cursor:pointer; }',
    '.room-card__image-button:focus-visible { outline:3px solid var(--teal); outline-offset:-3px; }',
    '.units-total.units-total--single { display:block; margin:6px 0 16px; padding:0; border:0; border-radius:0; background:none; color:var(--ink-soft); font-size:.82rem; font-weight:400; }',
  ];
  let original=normalized.replace(mapFix,oldMap).replace(spaGroups,'');
  for(const addition of unitAdditions){assert.equal(original.split(addition).length,2);original=original.replace(addition+'\n','');}
  const actual=composeWorldStyles(original.replace('@import "./public-fonts.css";',originalFontImport),sources).replace(/\r\n/g,'\n');
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
