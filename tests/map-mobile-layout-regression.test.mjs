import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createMapLayoutSynchronizer } from '../app/lib/map/map-layout-sync.ts';

const component = readFileSync(new URL('../app/components/map/leaflet-places-map.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('Leaflet map resynchronizes after hidden-to-visible mobile layout changes', () => {
  assert.match(component, /createMapLayoutSynchronizer/);
  assert.match(readFileSync(new URL('../app/lib/map/map-layout-sync.ts', import.meta.url), 'utf8'), /invalidateSize\(\{ animate: false, pan: false \}\)/);
  assert.match(component, /new IntersectionObserver/);
  assert.match(component, /layoutSync\.schedule\(\);/);
});

test('every shared map canvas has an explicit stretch geometry contract', () => {
  assert.match(css, /\.listing-map\s*\{[^}]*position:\s*relative/);
  assert.match(css, /\.listing-map-shell \.leaflet-container\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/);
  assert.match(css, /\.map-results-canvas,\.map-results-canvas \.listing-map-shell,\.map-results-canvas \.listing-map \{ width: 100%; height: 100dvh;/);
});

test('hidden-to-visible map geometry triggers a real Leaflet size invalidation', async () => {
  const dom = new JSDOM('<div id="map"></div>');
  const container = dom.window.document.querySelector('#map');
  assert.ok(container);
  Object.defineProperty(container, 'isConnected', { value: true });
  let width = 0;
  Object.defineProperty(container, 'clientWidth', { get: () => width });
  const invalidations = [];
  const frames = new Map();
  let nextFrame = 0;
  const view = {
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {},
  };
  const sync = createMapLayoutSynchronizer({ invalidateSize: (options) => invalidations.push({ width: container.clientWidth, options }) }, container, view);
  sync.schedule();
  assert.equal(invalidations[0].width, 0);
  width = 390;
  [...frames.values()].forEach((callback) => callback());
  assert.ok(invalidations.some(({ width: measured }) => measured === 390));
  assert.deepEqual(invalidations.at(-1).options, { animate: false, pan: false });
  sync.dispose();
  dom.window.close();
});
