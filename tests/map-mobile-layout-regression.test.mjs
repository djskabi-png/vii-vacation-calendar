import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../app/components/map/leaflet-places-map.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('Leaflet map resynchronizes after hidden-to-visible mobile layout changes', () => {
  assert.match(component, /const syncMapLayout = \(\) =>/);
  assert.match(component, /map\.invalidateSize\(\{ animate: false, pan: false \}\)/);
  assert.match(component, /new IntersectionObserver/);
  assert.match(component, /scheduleLayoutSync\(\);/);
});

test('every shared map canvas has an explicit stretch geometry contract', () => {
  assert.match(css, /\.listing-map\s*\{[^}]*position:\s*relative/);
  assert.match(css, /\.listing-map-shell \.leaflet-container\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/);
  assert.match(css, /\.map-results-canvas,\.map-results-canvas \.listing-map-shell,\.map-results-canvas \.listing-map \{ width: 100%; height: 100dvh;/);
});
