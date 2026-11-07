import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publicStyleBundleSources, publicStyleFiles } from '../build/public-style-bundles.mjs';
import { worldStyleSources, composeWorldStyles } from '../build/world-style-slots.mjs';
import { publicStyleWorld } from '../app/lib/public-style-world.ts';

test('full public bundle preserves byte order of every original stylesheet', () => {
  const bundles = publicStyleBundleSources();
  const fonts = fs.readFileSync('app/public-fonts.css', 'utf8');
  const original = [composeWorldStyles(fs.readFileSync('app/globals.css', 'utf8')).replace('@import "./public-fonts.css";', fonts), ...publicStyleFiles.slice(1).map(f => fs.readFileSync('app/' + f, 'utf8'))].join('\n');
  assert.equal(bundles.all, original);
});

test('world bundles remove only nonselected slots, retain shared pickers and cascade order', () => {
  const bundles = publicStyleBundleSources();
  const sources = worldStyleSources();
  for (const world of ['vacations', 'events', 'hourly', 'spa']) {
    assert.ok(bundles[world].length < bundles.all.length);
    assert.ok(bundles[world].includes('.event-date-dialog'));
    assert.ok(bundles[world].includes('.spa-calendar'));
    assert.ok(bundles[world].includes('.vacation-party-picker'));
    let cursor = -1;
    for (const entry of sources.manifest.slots.filter(s => s.world === world)) {
      const css = sources.slots.get(entry.marker);
      const next = bundles[world].indexOf(css, cursor + 1);
      assert.ok(next > cursor, `${world}:${entry.fragment} order`);
      cursor = next;
    }
  }
});

test('direct and localized world routes select the same CSS; mixed destinations keep full styles', () => {
  for (const prefix of ['', '/en', '/ru', '/fr']) {
    assert.equal(publicStyleWorld(prefix + '/events/search/north/lofts'), 'events');
    assert.equal(publicStyleWorld(prefix + '/search/events/marea-1-roomtypes-5-dd1c3d5d'), 'events');
    assert.equal(publicStyleWorld(prefix + '/search/spas/tel-aviv-pool'), 'spa');
    assert.equal(publicStyleWorld(prefix + '/search/hourly/north'), 'hourly');
    assert.equal(publicStyleWorld(prefix + '/search/vacations/israel'), 'vacations');
    assert.equal(publicStyleWorld(prefix + '/vacations/kinneret'), 'vacations');
    assert.equal(publicStyleWorld(prefix + '/spas/search/tel-aviv'), 'spa');
    assert.equal(publicStyleWorld(prefix + '/hourly'), 'hourly');
    for (const p of ['/', '/business', '/admin', '/booking', '/future-world']) assert.equal(publicStyleWorld(prefix + p), 'all');
  }
});
