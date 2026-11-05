import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

test("map provider boundary is wired around the normalized place renderer", () => {
  const source = fs.readFileSync(new URL("../app/components/map/leaflet-places-map.tsx", import.meta.url), "utf8");
  const boundary = fs.readFileSync(new URL("../app/components/map-provider-boundary.tsx", import.meta.url), "utf8");
  assert.match(source, /MapProviderBoundary places=\{places\} tone=\{tone\}/);
  assert.match(boundary, /places\.map\(\(place\) =>/);
  assert.match(boundary, /ניסיון חוזר/);
  assert.match(boundary, /this\.state\.failed/);
  assert.match(source, /\.catch\(\(error: unknown\).*setProviderError/);
  assert.match(source, /resetLeafletProvider\(\)/);
  assert.match(boundary, /language === "en"/);
});

test("actual boundary preserves every result and destination, localizes failure, and retries after render failure", () => {
  const source = fs.readFileSync(new URL("../app/components/map-provider-boundary.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => name === "react" ? React : name === "react/jsx-runtime" ? jsxRuntime : { default: ({ children, ...props }) => React.createElement("a", props, children) } });
  const Boundary = exports.MapProviderBoundary;
  const places = Array.from({ length: 17 }, (_, index) => ({ id: `p${index}`, name: `Place ${index}`, href: `/business?id=vacation-${index}&from=2026-11-20&guests=6` }));
  for (const [language, expected] of [["he", "המפה לא נטענה"], ["en", "The map could not load"], ["ru", "Карта не загрузилась"], ["fr", "La carte"]]) {
    let retries = 0;
    const component = new Boundary({ places, tone: "vacation", language, onRetry: () => retries++, children: React.createElement("div", { id: "provider" }, "map") });
    component.setState = update => { component.state = { ...component.state, ...update }; };
    assert.match(renderToStaticMarkup(component.render()), /id="provider"/);
    component.state = Boundary.getDerivedStateFromError(new Error("synthetic renderer failure"));
    const fallback = component.render();
    const html = renderToStaticMarkup(fallback);
    assert.ok(html.includes(expected)); assert.equal((html.match(/<a /g) || []).length, 17);
    assert.ok(html.includes("id=vacation-16&amp;from=2026-11-20&amp;guests=6"));
    fallback.props.children.find(child => child?.type === "button").props.onClick();
    assert.equal(retries, 1); assert.equal(component.state.failed, false);
    assert.match(renderToStaticMarkup(component.render()), /id="provider"/);
    component.props = { ...component.props, providerError: new Error("async import failure") };
    assert.equal((renderToStaticMarkup(component.render()).match(/<a /g) || []).length, 17);
  }
});

test("actual provider preload shares one import and reset replaces a rejected import for retry", async () => {
  const source = fs.readFileSync(new URL("../app/components/map/leaflet-places-map.tsx", import.meta.url), "utf8");
  const slice = source.slice(source.indexOf("let leafletModulePromise"), source.indexOf("function safeMarkerLabel"));
  const compiled = ts.transpileModule(slice, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; let calls = 0;
  vm.runInNewContext(compiled, { exports, window: {}, require: () => { calls++; if (calls === 1) throw new Error("synthetic import failure"); return { map() {} }; } });
  const first = exports.preloadLeaflet(); assert.equal(exports.preloadLeaflet(), first);
  await assert.rejects(first, /synthetic import failure/); assert.equal(calls, 1);
  exports.resetLeafletProvider(); const second = exports.preloadLeaflet(); assert.notEqual(first, second);
  assert.equal(typeof (await second).map, "function"); assert.equal(calls, 2);
});
