import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { criticalCssProjection } from '../build/public-critical-css.mjs';
import { publicStyleBundlesPlugin } from '../build/public-style-bundles.mjs';
const { build } = createRequire(import.meta.resolve('vite'))('esbuild');
const plugin = publicStyleBundlesPlugin();
const virtualSource = await plugin.load('\0virtual:vii-public-style-bundles');
const virtual = await import('data:text/javascript,' + encodeURIComponent(virtualSource));
const qa = resolve('.qa-output'); mkdirSync(qa, { recursive: true });
const dir = mkdtempSync(join(qa, 'critical-resource-'));
const entry = join(dir, 'entry.ts'), output = join(dir, 'entry.mjs');
writeFileSync(entry, "export{PublicStyleResources}from'../../app/components/public-style-resources.tsx';export*from'../../app/lib/public-critical-style-policy.ts';");
await build({ entryPoints: [entry], outfile: output, bundle: true, format: 'esm', platform: 'node', packages: 'external', logLevel: 'silent', plugins: [{ name: 'real-styles', setup(builder) { builder.onResolve({ filter: /^virtual:vii-public-style-bundles$/ }, () => ({ path: 'styles', namespace: 'actual' })); builder.onLoad({ filter: /.*/, namespace: 'actual' }, () => ({ contents: virtualSource, loader: 'js' })); } }] });
const { PublicStyleResources, publicStylesReadyBootstrap, hasQualifiedCriticalTemplate } = await import(pathToFileURL(output).href);
test.after(() => rmSync(dir, { recursive: true, force: true }));
function html(pathname, isFlight) { return renderToStaticMarkup(React.createElement('html', null, React.createElement('head', null, React.createElement(PublicStyleResources, { initialPath: pathname, isFlight })), React.createElement('body', null, 'content'))); }

test('critical projection retains original cascade order, nested media, fonts and keyframes', () => {
  const source = '@font-face{font-family:Rubik;src:url(/font.woff2)}.site-header{color:red}.unobserved-a{color:pink}@media(max-width:700px){.site-header{color:blue}.unobserved-b{display:none}}@keyframes pending{0%{opacity:0}100%{opacity:1}}';
  const result = criticalCssProjection(source);
  assert.ok(result.includes('@font-face'));
  assert.ok(result.includes('@keyframes pending'));
  assert.ok(result.includes('@media(max-width:700px){.site-header{color:blue}'));
  assert.ok(result.indexOf('color:red') < result.indexOf('color:blue'));
  assert.ok(!result.includes('unobserved-a'));
  assert.ok(result.includes('.unobserved-b{display:none}'));
});

test('critical styles also retain streamed loading surfaces before the complete world stylesheet arrives', () => {
  for (const world of ['all', 'vacations', 'events', 'spa', 'hourly']) {
    assert.ok(virtual.criticalStyles[world].includes('.global-route-loading{'), world);
    assert.ok(virtual.criticalStyles[world].includes('.global-route-loading__cards'), world);
  }
  for (const world of ['all', 'vacations']) {
    assert.ok(virtual.criticalStyles[world].includes('.vacation-route-loading{'), world);
    assert.ok(virtual.criticalStyles[world].includes('.vacation-route-loading h2{'), world);
    assert.ok(virtual.criticalStyles[world].includes('.vacation-route-loading__cards'), world);
  }
});

test('SPA and home rails keep their complete card geometry before deferred styles arrive', () => {
  for (const world of ['all', 'spa']) {
    assert.match(virtual.criticalStyles[world], /\.spa-package-deals \.event-rail\{[^}]*display:flex/);
    assert.match(virtual.criticalStyles[world], /\.spa-deal-card\{[^}]*flex:0 0/);
    assert.match(virtual.criticalStyles[world], /\.spa-deal-card__image\{[^}]*aspect-ratio:/);
    assert.match(virtual.criticalStyles[world], /\.spa-deal-card__image img\{[^}]*object-fit:cover/);
  }
  assert.ok(!virtual.default.events.includes('spa-package-deals'));
});

test('real initial HTML orders critical before full resources and supplies a no-JavaScript fallback', () => {
  const markup = html('/vacations/kinneret', false);
  const document = new JSDOM(markup).window.document;
  const styles = [...document.head.querySelectorAll('style,link[rel=stylesheet]')];
  assert.equal(styles[0].tagName, 'STYLE');
  assert.equal(styles[0].dataset.precedence, 'vii-critical');
  const full = document.querySelector('link[data-vii-deferred-style]');
  assert.equal(full.media, 'print');
  assert.equal(full.dataset.precedence, 'vii-public');
  const activeFullLinks = [...document.head.querySelectorAll(`link[rel=stylesheet][href="${virtual.default.vacations}"]`)].filter(link => !link.closest('noscript'));
  assert.equal(activeFullLinks.length, 1);
  assert.equal(activeFullLinks[0].media, 'print');
  assert.equal(document.querySelector('noscript link[rel=stylesheet]')?.getAttribute('href'), virtual.default.vacations);
  assert.ok(virtual.criticalStyles.vacations.length < 220_000);
  assert.ok(virtual.criticalStyles.vacations.includes('Rubik'));
});

test('Flight and uncaptured templates keep native blocking stylesheet delivery with no new client reference', () => {
  for (const pathname of ['/', '/vacations/kinneret', '/events', '/spas', '/hourly', '/business', '/en/vacations/kinneret']) {
    const markup = html(pathname, true);
    assert.ok(!markup.includes('media="print"'));
    assert.ok(!markup.includes('vii-critical:'));
    assert.ok(markup.includes('data-precedence="vii-public"'));
  }
  for (const pathname of ['/events/search/north', '/spas/search/tel-aviv/spa-with-pool', '/business', '/en', '/en/spas']) assert.ok(!html(pathname, false).includes('media="print"'));
});

test('the three additional world roots have real desktop/mobile captures and bounded first-paint styles', () => {
  const captures = JSON.parse(readFileSync('app/styles/public-critical-selectors.json', 'utf8')).captures;
  for (const [pathname, world] of [['/events', 'events'], ['/spas', 'spa'], ['/hourly', 'hourly']]) {
    const observed = captures.filter(capture => new URL(capture.url).pathname === pathname);
    assert.ok(observed.some(capture => capture.viewport.width < 600), pathname + ' mobile');
    assert.ok(observed.some(capture => capture.viewport.width >= 1000), pathname + ' desktop');
    const markup = html(pathname, false);
    assert.ok(markup.includes('vii-critical:'));
    assert.ok(markup.includes('media="print"'));
    assert.ok(virtual.criticalStyles[world].length > 10_000);
    assert.ok(virtual.criticalStyles[world].length < 220_000);
    assert.ok(virtual.criticalStyles[world].includes('Rubik'));
  }
});

test('every enabled regional critical template names an actual approved regional route', () => {
  const data = readFileSync('app/data/vacation-landings.ts', 'utf8');
  const regions = [...data.matchAll(/\{ slug: "([^"]+)", label:/g)].map(match => match[1]);
  assert.equal(regions.length, 11);
  for (const region of regions) assert.equal(hasQualifiedCriticalTemplate('/vacations/' + region), true);
  assert.equal(hasQualifiedCriticalTemplate('/vacations/not-a-region'), false);
});

test('deferred resource activates on actual load, recovers already loaded sheets, and does not affect unrelated styles', () => {
  const page = new JSDOM('<link id="pending" rel="stylesheet" media="print" data-vii-deferred-style><link id="unrelated" media="print">', { runScripts: 'outside-only' });
  page.window.eval(publicStylesReadyBootstrap);
  const pending = page.window.document.getElementById('pending');
  assert.equal(pending.media, 'print');
  pending.dispatchEvent(new page.window.Event('load'));
  assert.equal(pending.media, 'all');
  assert.equal(page.window.document.getElementById('unrelated').media, 'print');
  pending.media = 'print';
  Object.defineProperty(pending, 'sheet', { value: {} });
  page.window.dispatchEvent(new page.window.Event('pageshow'));
  assert.equal(pending.media, 'all');
  page.window.close();
});
