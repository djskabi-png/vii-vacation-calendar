import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const consent = await readFile(new URL("../app/components/cookie-consent.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/app-experience.css", import.meta.url), "utf8");

test("first visit keeps the consent notice in SSR while saved choice hides it before paint", () => {
  assert.match(consent, /useState\(true\)/);
  assert.match(layout, /vii-cookie-choice/);
  assert.match(layout, /dataset\.viiCookieChoice='saved'/);
  assert.match(css, /\[data-vii-cookie-choice="saved"\] \.cookie-card--notice \{ display: none; \}/);
});

test("saved-choice bootstrap is storage-safe and settings remain reopenable", () => {
  const expression = layout.match(/const cookieChoiceBootstrap = `(.*?)`;/s)?.[1];
  assert.ok(expression);
  for (const [choice, expected] of [["all", "saved"], ["essential", "saved"], [null, undefined], ["corrupt", undefined]]) {
    const dataset = {};
    const storage = { getItem: () => choice };
    vm.runInNewContext(expression, { localStorage: storage, document: { documentElement: { dataset } } });
    assert.equal(dataset.viiCookieChoice, expected, String(choice));
  }
  assert.doesNotThrow(() => vm.runInNewContext(expression, { localStorage: { getItem: () => { throw new Error("blocked"); } }, document: { documentElement: { dataset: {} } } }));
  assert.match(layout, /try\{var c=localStorage\.getItem\('vii-cookie-choice'\)/);
  assert.match(layout, /catch\(_\)\{\}/);
  assert.match(css, /cookie-card--notice/);
  assert.doesNotMatch(css, /data-vii-cookie-choice="saved"[^}]*cookie-card--settings/);
  assert.match(consent, /OPEN_EVENT/);
  assert.match(consent, /function readCookieChoice\(\)/);
  assert.match(consent, /function writeCookieChoice\(value: CookieChoice\)/);
  assert.match(consent, /Consent UI remains usable when storage is blocked/);
});

test("actual consent component is SSR-visible, storage-safe, and reopens settings", async () => {
  const source = await readFile(new URL("../app/components/cookie-consent.tsx", import.meta.url), "utf8");
  const js = (await import("typescript")).default.transpileModule(source, { compilerOptions: { module: 1, jsx: 4, target: 7 } }).outputText;
  function render(choice, blocked = false) {
    let state = [true, false], cursor = 0, effect;
    const listeners = {};
    const storage = { getItem: () => blocked ? (() => { throw new Error("blocked"); })() : choice, setItem: value => { if (blocked) throw new Error("blocked"); choice = value; } };
    let scheduled;
    const window = { localStorage: storage, setTimeout: fn => (scheduled = fn, 1), clearTimeout() {}, location: { hash: "", pathname: "/", search: "" }, history: { replaceState() {} }, addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener() {}, dispatchEvent: event => { listeners[event.type]?.(event); } };
    const react = { useState: initial => { const i = cursor++; return [state[i] ?? initial, value => { state[i] = typeof value === "function" ? value(state[i]) : value; }]; }, useEffect: fn => { effect = fn; } };
    const jsx = (type, props) => ({ type, props: props || {} });
    const exports = {};
    new Function("require", "exports", "window", "localStorage", js)(id => id === "react" ? react : id === "react/jsx-runtime" ? { jsx, jsxs: jsx } : id.includes("locale-provider") ? { useSiteLanguage: () => ({ language: "he" }) } : {}, exports, window, storage);
    const render = () => { cursor = 0; return exports.CookieConsent(); };
    const first = render(); effect?.(); const timer = { flush: () => { scheduled?.(); } };
    return { first, render, timer, listeners, storage, state: () => state };
  }
  const fresh = render(null); assert.equal(fresh.first.type, "aside"); fresh.timer.flush(); assert.equal(fresh.render().type, "aside");
  const savedAll = render("all"); savedAll.timer.flush(); assert.equal(savedAll.render(), null);
  const savedEssential = render("essential"); savedEssential.timer.flush(); assert.equal(savedEssential.render(), null);
  assert.doesNotThrow(() => render(null, true).timer.flush());
  const reopen = render(null); reopen.listeners["vii-open-cookie-settings"]?.(); const settings = reopen.render(); assert.match(settings.props.className, /settings/);
});
