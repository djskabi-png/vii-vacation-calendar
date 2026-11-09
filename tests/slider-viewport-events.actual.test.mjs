import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function fixture() {
  const source = readFileSync(process.env.VII_GUARD_SOURCE || 'app/components/responsive-viewport-guard.tsx', 'utf8');
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const listeners = new Map(), frames = new Map(), timers = new Map();
  const rails = [{scrollLeft: 0}, {scrollLeft: 0}];
  let query = '', nextId = 1, cleanups = [];
  const body = {scrollLeft: 0, style: {}, hasAttribute: () => false, removeAttribute() {}, toggleAttribute() {}};
  const documentElement = {scrollLeft: 0, style: {}};
  const scrollingElement = {scrollLeft: 0};
  const document = {body, documentElement, scrollingElement, querySelector: () => null,
    querySelectorAll: selector => selector === '[data-horizontal-rail]' ? rails : []};
  const window = {matchMedia: () => ({matches: false}),
    requestAnimationFrame: fn => {const id = nextId++; frames.set(id, fn); return id;},
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: fn => {const id = nextId++; timers.set(id, fn); return id;}, clearTimeout: id => timers.delete(id),
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
    visualViewport: {addEventListener: (name, fn) => listeners.set(`visual:${name}`, fn), removeEventListener: name => listeners.delete(`visual:${name}`)},
  };
  const Observer = class {observe() {} unobserve() {} disconnect() {}};
  const module = {exports: {}};
  vm.runInNewContext(code, {module, exports: module.exports, document, window, IntersectionObserver: Observer, MutationObserver: Observer,
    require: name => {
      if (name === 'react') return {useEffect: fn => cleanups.push(fn())};
      if (name === 'next/navigation') return {usePathname: () => '/spas', useSearchParams: () => new URLSearchParams(query)};
      throw Error(name);
    },
  });
  function flush() {for (const queue of [frames, timers]) {const pending = [...queue.values()]; queue.clear(); pending.forEach(fn => fn());}}
  function render(nextQuery = '') {cleanups.forEach(fn => fn?.()); cleanups = []; query = nextQuery; module.exports.ResponsiveViewportGuard(); flush();}
  render();
  return {rails, body, documentElement, scrollingElement, listeners, frames, timers, flush, render,
    emit: name => {listeners.get(name)?.(); flush();}, cleanup: () => {cleanups.forEach(fn => fn?.()); cleanups = [];}};
}

test('SPA audience/date query changes preserve both independently moved carousels', () => {
  const f = fixture(); f.rails[0].scrollLeft = -220; f.rails[1].scrollLeft = -687.1875;
  f.render('spaDealDate=2026-11-09&spaDealFor=couple');
  assert.deepEqual(f.rails.map(r => r.scrollLeft), [-220, -687.1875]);
  f.render('spaDealDate=2026-11-10&spaDealFor=group');
  assert.deepEqual(f.rails.map(r => r.scrollLeft), [-220, -687.1875]); f.cleanup();
});

test('touchend, resize, restore and orientation repair root drift without touching nested rails', () => {
  const f = fixture(); f.rails[0].scrollLeft = -220; f.rails[1].scrollLeft = 330;
  for (const event of ['touchend', 'resize', 'visual:resize', 'pageshow', 'popstate', 'orientationchange', 'scroll']) {
    f.scrollingElement.scrollLeft = -19; f.documentElement.scrollLeft = -19; f.body.scrollLeft = -19;
    f.emit(event);
    assert.equal(f.scrollingElement.scrollLeft, 0, event); assert.equal(f.body.scrollLeft, 0, event);
    assert.deepEqual(f.rails.map(r => r.scrollLeft), [-220, 330], event);
  }
  f.cleanup(); assert.equal(f.listeners.size, 0); assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
});
