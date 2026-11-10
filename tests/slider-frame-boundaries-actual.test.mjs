import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync('app/components/slider-rail-controls.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture(offset = 0, count = 3, width = 800, viewport = 300) {
  const frames = new Map(), effects = [], resize = [], mutations = [], events = new Map();
  let nextFrame = 0, reads = 0, presenceScans = 0, itemScans = 0, writes = 0;
  let state;
  const items = Array.from({ length: count }, () => ({}));
  const rail = {
    querySelector() { presenceScans++; return items[0] ?? null; },
    querySelectorAll() { itemScans++; return items; },
    get scrollWidth() { reads++; return width; },
    get clientWidth() { reads++; return viewport; },
    get scrollLeft() { return offset; },
    set scrollLeft(value) { writes++; offset = value; },
    addEventListener(name, cb) { events.set(name, cb); },
    removeEventListener(name) { events.delete(name); },
  };
  class Resize { constructor(cb) { this.cb = cb; this.items = new Set(); resize.push(this); } observe(item) { this.items.add(item); } disconnect() { this.items.clear(); } }
  class Mutation { constructor(cb) { this.cb = cb; mutations.push(this); } observe() {} disconnect() {} }
  const react = { useState(initial) { state = initial; return [state, value => { state = typeof value === 'function' ? value(state) : value; }]; }, useRef: value => ({ current: value }), useCallback: cb => cb, useLayoutEffect: cb => effects.push(cb) };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require(name) { if (name === 'react') return react; if (name.includes('locale-provider')) return {}; if (name === 'lucide-react' || name === 'react/jsx-runtime') return {}; throw Error(name); }, document: { getElementById: () => rail }, window: { requestAnimationFrame(cb) { const id = nextFrame++; frames.set(id, cb); return id; }, cancelAnimationFrame(id) { frames.delete(id); }, addEventListener(name, cb) { events.set('window:' + name, cb); }, removeEventListener(name) { events.delete('window:' + name); } }, ResizeObserver: Resize, MutationObserver: Mutation });
  const boundary = module.exports.useSliderRailBoundaries({ railId: 'rail' });
  const cleanup = effects.map(effect => effect());
  return { boundary, rail, frames, resize, mutations, events, items, flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb()); }, cleanup() { cleanup.forEach(cb => cb?.()); }, counts() { return { reads, presenceScans, itemScans, writes }; }, state: () => state, setGeometry(a, b) { width = a; viewport = b; } };
}

test('actual hook collapses resize mutation and scroll bursts into one geometry read per frame', () => {
  const f = fixture();
  assert.equal(f.counts().reads, 0, 'mount does not synchronously read scrollWidth/clientWidth');
  for (let n = 0; n < 50; n++) { f.resize[0].cb(); f.mutations[0].cb(); f.events.get('scroll')(); }
  assert.equal(f.frames.size, 1, 'RAF id zero is still a pending measurement');
  f.flush();
  assert.equal(f.counts().reads, 2);
  assert.equal(f.counts().presenceScans, 1);
  assert.equal(f.state().previous, false);
  assert.equal(f.state().next, true);
  assert.equal(f.resize[0].items.size, 4, 'rail and every card remain observed');
});

test('actual hook keeps arrows unavailable until measured, including streamed and non-overflow rails', () => {
  const ready = fixture();
  assert.equal(ready.boundary.previous, false);
  assert.equal(ready.boundary.next, false, 'SSR and hydration cannot advertise a live handler');
  ready.flush();
  assert.equal(ready.state().next, true, 'the measured overflow rail becomes usable');
  ready.cleanup();
  const fits = fixture(0, 2, 300, 300);
  assert.equal(fits.boundary.next, false);
  fits.flush();
  assert.equal(fits.state().next, false, 'a fitting desktop row must not expose a dead next arrow');
  fits.cleanup();
});

test('actual hook keeps RTL boundaries and reacts to card size changes', () => {
  const f = fixture(-150);
  assert.equal(f.rail.scrollLeft, 0, 'restored RTL position normalized before controls publish');
  assert.equal(f.counts().writes, 1);
  f.flush();
  f.rail.scrollLeft = -500;
  f.events.get('scroll')(); f.flush();
  assert.equal(f.state().previous, true); assert.equal(f.state().next, false);
  f.setGeometry(1200, 300); f.resize[0].cb(); f.flush();
  assert.equal(f.state().next, true);
  assert.equal(f.rail.scrollLeft, -500, 'measurement never resets a user position');
});

test('actual hook handles streamed items and cancels pending work on cleanup', () => {
  const f = fixture(0, 0);
  f.flush(); assert.equal(f.state().next, false);
  const item = {}; f.items.push(item); f.mutations[0].cb(); f.flush();
  assert.equal(f.resize[0].items.has(item), true); assert.equal(f.state().next, true);
  f.boundary.update(); assert.equal(f.frames.size, 1);
  const before = f.counts().reads; f.cleanup();
  assert.equal(f.frames.size, 0); assert.equal(f.events.size, 0);
  f.resize[0].cb(); f.boundary.update(); f.flush();
  assert.equal(f.counts().reads, before, 'late observer callback after unmount cannot schedule a read');
});

test('shared boundary model uses visible DOM overflow for both RTL scroll conventions', () => {
  const loaded = { exports: {} };
  vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, require(name) { if (name === 'react') return {}; if (name === 'lucide-react' || name.includes('locale-provider') || name === 'react/jsx-runtime') return {}; throw Error(name); }, getComputedStyle: () => ({ direction: 'ltr' }) });
  const boundary = loaded.exports.sliderRailBoundaryState;
  const check = (input, expected) => assert.deepEqual(JSON.parse(JSON.stringify(boundary(input))), expected);
  check({ rtl: true, railLeft: 0, railRight: 300, itemRects: [{ left: -120, right: -20 }, { left: 10, right: 110 }, { left: 220, right: 320 }], fallbackProgress: 0, fallbackMax: 600 }, { previous: true, next: true });
  check({ rtl: true, railLeft: 0, railRight: 300, itemRects: [{ left: 0, right: 100 }, { left: 110, right: 210 }, { left: 220, right: 320 }], fallbackProgress: 0, fallbackMax: 600 }, { previous: true, next: false });
  check({ rtl: true, railLeft: 0, railRight: 300, itemRects: [{ left: -320, right: -220 }, { left: -110, right: -10 }, { left: 10, right: 110 }], fallbackProgress: 600, fallbackMax: 600 }, { previous: true, next: false });
});
