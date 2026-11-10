import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

function leafletTileSize(devicePixelRatio) {
  const script = `
    import { JSDOM } from 'jsdom';
    const dom = new JSDOM('<div id="map" style="width:390px;height:300px"></div>', { url: 'https://vii.spaplus.co' });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
    dom.window.devicePixelRatio = ${devicePixelRatio};
    const L = await import('leaflet');
    const map = L.map(dom.window.document.querySelector('#map'), { zoomControl: false });
    const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { detectRetina: true });
    console.log(JSON.stringify({ retina: L.Browser.retina, tileSize: layer.options.tileSize }));
    map.remove();
  `;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }).trim());
}

test('installed Leaflet uses 256px at DPR1 and 128px retina layout at DPR2/3', () => {
  assert.deepEqual(leafletTileSize(1), { retina: false, tileSize: 256 });
  assert.deepEqual(leafletTileSize(2), { retina: true, tileSize: 128 });
  assert.deepEqual(leafletTileSize(3), { retina: true, tileSize: 128 });
});

test('current tile CSS preserves Leaflet inline geometry', () => {
  assert.match(css, /\.listing-map-shell \.leaflet-tile \{ max-width: none !important; \}/);
  assert.doesNotMatch(css, /\.listing-map-shell \.leaflet-tile \{ width: 256px !important;/);
  const dom = new JSDOM(`<style>${css}</style><div class="listing-map-shell"><div class="leaflet-container"><img class="leaflet-tile" style="width:128px;height:128px"></div></div>`, { url: "https://vii.spaplus.co/" });
  const tile = dom.window.document.querySelector('.leaflet-tile');
  assert.equal(tile.style.width, '128px');
  assert.equal(dom.window.getComputedStyle(tile).width, '128px');
  assert.equal(dom.window.getComputedStyle(tile).height, '128px');
});

test('negative control proves the old forced width breaks retina geometry', () => {
  const dom = new JSDOM('<style>.leaflet-container .leaflet-tile{width:auto}.listing-map-shell .leaflet-tile{width:256px!important;max-width:none!important}</style><div class="listing-map-shell"><div class="leaflet-container"><img class="leaflet-tile" style="width:128px;height:128px"></div></div>');
  const tile = dom.window.document.querySelector('.leaflet-tile');
  assert.equal(tile.style.width, '128px');
  assert.equal(dom.window.getComputedStyle(tile).width, '256px');
  assert.notEqual(dom.window.getComputedStyle(tile).width, tile.style.width);
});
