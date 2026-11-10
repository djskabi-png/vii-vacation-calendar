import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadRailMotion() {
  const source = readFileSync(new URL("../app/components/slider-rail-controls.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  const oldComputed = globalThis.getComputedStyle;
  const oldWindow = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.getComputedStyle = (rail) => ({ direction: rail.direction || "ltr" });
  try {
    new Function("require", "module", "exports", code)((name) => {
      if (name === "react" || name === "react/jsx-runtime") return { useCallback: (fn) => fn, useLayoutEffect() {}, useRef: () => ({ current: null }), useState: (value) => [value, () => {}], jsx: () => null, jsxs: () => null, Fragment: "fragment" };
      if (name === "lucide-react") return { ChevronLeft: () => null, ChevronRight: () => null };
      if (name === "../i18n/locale-provider") return { useSiteLanguage: () => ({ language: "he" }) };
      throw new Error(`unexpected import: ${name}`);
    }, module, module.exports);
    return module.exports;
  } finally {
    globalThis.getComputedStyle = oldComputed;
    globalThis.window = oldWindow;
  }
}

function railFixture(direction = "ltr") {
  const calls = [];
  const rects = [0, 110, 220, 330].map((offset) => direction === "rtl"
    ? { right: 400 - offset, left: 300 - offset }
    : { left: 100 + offset, right: 200 + offset });
  const items = rects.map((rect) => ({ getBoundingClientRect: () => rect }));
  const rail = {
    direction,
    scrollLeft: 0,
    scrollWidth: 440,
    clientWidth: 100,
    querySelectorAll: () => items,
    scrollTo: (options) => calls.push(options),
  };
  return { rail, calls };
}

function withRailGlobals(fn) {
  const oldComputed = globalThis.getComputedStyle;
  const oldWindow = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.getComputedStyle = (rail) => ({ direction: rail.direction || "ltr" });
  try { return fn(); } finally { globalThis.getComputedStyle = oldComputed; globalThis.window = oldWindow; }
}

test("actual motion advances through every padded snap in both directions and after a swipe", () => {
  const { moveSliderRailByCard } = loadRailMotion();
  const oldComputed = globalThis.getComputedStyle, oldWindow = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.getComputedStyle = rail => ({ direction: rail.direction, scrollPaddingInlineStart: "10px", scrollPaddingInlineEnd: "10px" });
  try {
    for (const width of [315, 330.5, 352, 1180]) for (const direction of ["rtl", "ltr"]) {
      const stride = 230.25, max = stride * 10 + 220.25 - width;
      let progress = 0;
      const rail = { direction, clientWidth: width, scrollWidth: width + max,
        get scrollLeft() { return progress * (direction === "rtl" ? -1 : 1); },
        querySelectorAll() { return Array.from({length:11}, (_, index) => ({getBoundingClientRect() { const start = index * stride - progress; return direction === "rtl" ? {right:width-start,left:width-start-220.25} : {left:start,right:start+220.25}; }})); },
        scrollTo({left}) { const requested = Math.abs(left); progress = requested === max ? max : requested === 0 ? 0 : Math.max(0, requested - 10.35); },
      };
      for (let index = 0; index < 12 && progress < max; index++) { const before = progress; moveSliderRailByCard(rail, 1); assert.ok(progress > before, `${direction}/${width} stalled at ${progress}`); }
      assert.equal(progress, max);
      for (let index = 0; index < 12 && progress > 0; index++) { const before = progress; moveSliderRailByCard(rail, -1); assert.ok(progress < before, `${direction}/${width} reverse stalled at ${progress}`); }
      assert.equal(progress, 0);
      progress = max * 0.63; const swiped = progress;
      moveSliderRailByCard(rail, -1); assert.ok(progress < swiped);
      moveSliderRailByCard(rail, 1); assert.ok(progress > swiped - stride);
    }
  } finally { globalThis.getComputedStyle = oldComputed; globalThis.window = oldWindow; }
});

function loadGuard() {
  const source = readFileSync(new URL("../app/components/responsive-viewport-guard.tsx", import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const listeners = new Map();
  const rails = [{ scrollLeft: 184 }, { scrollLeft: 372 }];
  const scrollingElement = { scrollLeft: 0 };
  const fakeDocument = {
    body: { scrollLeft: 0, hasAttribute: () => false, style: {}, removeAttribute() {}, toggleAttribute() {} },
    documentElement: { scrollLeft: 0, style: {} },
    scrollingElement,
    querySelector: () => null,
    querySelectorAll: (selector) => selector === "[data-horizontal-rail]" ? rails : [],
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
  };
  const fakeWindow = {
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (fn) => { fn(); return 1; },
    cancelAnimationFrame() {},
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout() {},
    addEventListener: (name, handler) => listeners.set(`window:${name}`, handler),
    removeEventListener: (name) => listeners.delete(`window:${name}`),
    visualViewport: { addEventListener: (name, handler) => listeners.set(`visual:${name}`, handler), removeEventListener() {} },
  };
  const oldDocument = globalThis.document;
  const oldWindow = globalThis.window;
  const oldResizeObserver = globalThis.ResizeObserver;
  const oldIntersectionObserver = globalThis.IntersectionObserver;
  const oldMutationObserver = globalThis.MutationObserver;
  globalThis.document = fakeDocument;
  globalThis.window = fakeWindow;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  const module = { exports: {} };
  try {
    new Function("require", "module", "exports", code)((name) => {
      if (name === "react") return { useEffect: (fn) => fn() };
      if (name === "next/navigation") return { usePathname: () => "/", useSearchParams: () => new URLSearchParams() };
      throw new Error(`unexpected import: ${name}`);
    }, module, module.exports);
    const Guard = module.exports.ResponsiveViewportGuard;
    Guard();
    return { Guard, listeners, rails, scrollingElement };
  } finally {
    globalThis.document = oldDocument;
    globalThis.window = oldWindow;
    globalThis.ResizeObserver = oldResizeObserver;
    globalThis.IntersectionObserver = oldIntersectionObserver;
    globalThis.MutationObserver = oldMutationObserver;
  }
}

test("a touch-end or root viewport guard cannot reset an in-progress rail", () => {
  const fixture = loadGuard();
  assert.equal(fixture.listeners.has("window:touchend"), true, "touchend still guards the document viewport");
  assert.deepEqual(fixture.rails.map((rail) => rail.scrollLeft), [184, 372]);
});

test("query/path restoration owns the document viewport without rewinding nested rails", () => {
  const fixture = loadGuard();
  const source = readFileSync(new URL("../app/components/responsive-viewport-guard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /resetHorizontalCollections\(\)/, "nested rails must not be globally reset on query changes");
  assert.match(source, /window\.addEventListener\("pageshow", reset/);
  assert.match(source, /window\.addEventListener\("popstate", reset/);
  assert.match(source, /window\.addEventListener\("touchend", lockHorizontalScroll/);
  assert.equal(fixture.scrollingElement.scrollLeft, 0);
});

test("shared rail motion advances one bounded anchor in LTR and RTL without touching ancestors", () => {
  const { moveSliderRailByCard } = loadRailMotion();
  for (const direction of ["ltr", "rtl"]) {
    const { rail, calls } = railFixture(direction);
    withRailGlobals(() => moveSliderRailByCard(rail, 1));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].left, direction === "rtl" ? -110 : 110);
    withRailGlobals(() => moveSliderRailByCard(rail, 1));
    assert.equal(calls.length, 2, "a second click remains one anchor step, not a run to the end");
    assert.equal(calls[1].left, calls[0].left);
    assert.equal(rail.scrollLeft, 0, "the helper only writes the rail through scrollTo");
  }
});

test("shared rail motion reverses from a settled anchor and clamps at the ends", () => {
  const { moveSliderRailByCard } = loadRailMotion();
  const { rail, calls } = railFixture("ltr");
  rail.scrollLeft = 110;
  withRailGlobals(() => moveSliderRailByCard(rail, -1));
  assert.equal(calls.at(-1).left, 0);
  rail.scrollLeft = 999;
  withRailGlobals(() => moveSliderRailByCard(rail, 1));
  assert.equal(calls.at(-1).left, 340);
});
