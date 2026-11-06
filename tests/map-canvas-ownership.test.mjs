import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Execute the production JSX composition in both readiness states. The canvas
// is an imperative Leaflet boundary: changing its class prop would erase the
// provider's leaflet-container, touch and zoom classes during reconciliation.
function canvasTree(mapReady) {
  const source = readFileSync(new URL('../app/components/map/leaflet-places-map.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('map.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'mapCanvas') initializer = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(initializer);
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    mapReady, tone: 'vacation', single: true, interactive: true, mapElement: {},
    mapCopy: { label: 'map' }, viewportDirty: false, autoLoad: true,
    previewContent: null, onClose: undefined,
  };
  const compiled = ts.transpileModule(`return (${initializer});`, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function('require', 'exports', ...Object.keys(dependencies), compiled)(() => ({ jsx, jsxs: jsx }), {}, ...Object.values(dependencies));
}

test('readiness changes the React shell without overwriting Leaflet-owned canvas classes', () => {
  const loading = canvasTree(false), ready = canvasTree(true);
  assert.equal(loading.props['data-map-ready'], false);
  assert.equal(ready.props['data-map-ready'], true);
  const loadingCanvas = loading.props.children[0], readyCanvas = ready.props.children[0];
  assert.equal(loadingCanvas.props.className, readyCanvas.props.className);
  assert.equal(readyCanvas.props.className, 'listing-map');
  const css = readEffectiveWorldCss();
  assert.match(css, /\.listing-map-shell\[data-map-ready="true"\]\s*>\s*\.listing-map\s*\{\s*opacity:\s*1/);
});
