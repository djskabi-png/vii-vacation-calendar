import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';

const source = fs.readFileSync(new URL('../app/components/unit-preview-gallery.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function load(hookController) {
  const module = { exports: {} };
  const fakeReact = {
    useMemo: (factory) => factory(),
    useRef: (value) => { const slot = hookController.refCursor++; if (!(slot in hookController.refs)) hookController.refs[slot] = { current: value }; return hookController.refs[slot]; },
    useEffect: () => {},
    useState: (initial) => hookController.useState(initial),
  };
  Function('require', 'module', 'exports', js)(name => {
    if (name === 'react') return fakeReact;
    if (name === 'react/jsx-runtime') return jsx;
    if (name === './use-preview-gallery') return hookController.preview;
    if (name === './responsive-card-image') return { ResponsiveCardImage: props => React.createElement('img', props) };
    if (name === '../i18n/locale-provider') return { useSiteLanguage: () => ({ language: 'he' }) };
    throw Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports.UnitPreviewGallery;
}

function harness(images) {
  const state = { values: [], refs: [], refCursor: 0, cursor: 0, index: 0, pending: false, warm: 0 };
  const controller = { refs: state.refs, refCursor: 0 };
  Object.assign(controller, {
    useState(initial) {
      const slot = state.cursor++;
      if (!(slot in state.values)) state.values[slot] = typeof initial === 'function' ? initial() : initial;
      return [state.values[slot], updater => { state.values[slot] = typeof updater === 'function' ? updater(state.values[slot]) : updater; }];
    },
    preview: {
      usePreviewGallery() {
        return { imageIndex: state.index, navigationIndex: state.index, setImageIndex: updater => { state.index = typeof updater === 'function' ? updater(state.index) : updater; }, warmImages: () => { state.warm += 1; }, pending: state.pending };
      },
    },
  });
  const Component = load(controller);
  const render = () => { state.cursor = 0; controller.refCursor = 0; return Component({ images, roomName: 'Room', propertyName: 'Place', onOpen: index => { state.opened = index; } }); };
  return { state, render };
}

function allElements(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (typeof node.type === 'function') return allElements(node.type(node.props), out);
  out.push(node);
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) allElements(child, out);
  return out;
}
function find(node, predicate) { return allElements(node).find(predicate); }

test('actual unit preview keeps full deduped gallery and original indices', () => {
  const { state, render } = harness(['/a.jpg', '', '/b.jpg', '/a.jpg', '/c.jpg']);
  const tree = render();
  assert.equal(find(tree, n => n.type === 'span' && String(n.props.children).includes('/')).props.children.join(''), '1/3');
  const image = find(tree, n => n.type === 'img');
  assert.equal(image.props.src, '/a.jpg');
  find(tree, n => n.type === 'button' && n.props['data-gallery-trigger']).props.onClick();
  assert.equal(state.opened, 0);
  assert.equal(allElements(tree).filter(n => n.type === 'img').length, 1);
});

test('actual unit preview advances on failed image and never falls back to another unit', () => {
  const h = harness(['/a.jpg', '/b.jpg', '/c.jpg']);
  let tree = h.render();
  find(tree, n => n.type === 'img').props.onOriginalFailure();
  tree = h.render();
  assert.equal(find(tree, n => n.type === 'img').props.src, '/b.jpg');
  find(tree, n => n.type === 'img').props.onOriginalFailure();
  find(h.render(), n => n.type === 'img').props.onOriginalFailure();
  assert.equal(h.render().props.role, 'img');
  assert.match(h.render().props['aria-label'], /אין תמונה/);
});

test('actual unit preview arrow bounds, keyboard direction, swipe click suppression and identity reset', () => {
  globalThis.window = { setTimeout() {} };
  const h = harness(['/a.jpg', '/b.jpg', '/c.jpg']);
  let tree = h.render();
  const next = find(tree, n => n.type === 'button' && n.props['aria-label']?.startsWith('התמונה הבאה'));
  next.props.onClick({ preventDefault() {}, stopPropagation() {} });
  assert.equal(h.state.index, 1);
  tree = h.render();
  find(tree, n => n.type === 'button' && n.props['data-gallery-trigger']).props.onKeyDown({ key: 'ArrowLeft', preventDefault() {} });
  assert.equal(h.state.index, 2);
  const root = tree;
  root.props.onTouchStart({ changedTouches: [{ clientX: 200 }] });
  root.props.onTouchEnd({ changedTouches: [{ clientX: 100 }] });
  assert.equal(h.state.index, 2);
  tree = h.render();
  find(tree, n => n.type === 'button' && n.props['data-gallery-trigger']).props.onClick();
  assert.equal(h.state.opened, undefined, 'swipe must suppress the following click');
  const changed = harness(['/x.jpg', '/y.jpg']);
  assert.equal(find(changed.render(), n => n.type === 'img').props.src, '/x.jpg');
});
