import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
import * as actualSearchState from '../app/lib/provider-search-state.ts';

const require = createRequire(import.meta.url);
const searchState = actualSearchState;
const source = fs.readFileSync(process.env.VII_PROVIDER_TEST_SOURCE || new URL('../app/components/provider-results.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

const items = [
  { id: 'music-1', name: 'DJ Music', area: 'מרכז', description: 'מוזיקה לאירועים', features: [], searchTerms: ['dj'], serviceAreas: ['מרכז'], image: '/music.jpg', priceLabel: '₪500' },
  { id: 'food-1', name: 'שף פרטי', area: 'צפון', description: 'שף וקייטרינג', features: [], searchTerms: ['שף'], serviceAreas: ['צפון'], image: '/food.jpg', priceLabel: '₪700' },
];

async function fixture(initialUrl = 'https://vii.test/providers?q=Liran&region=מרכז&sort=price') {
  const page = new JSDOM('<div id="root"></div>', { url: initialUrl });
  const previous = new Map();
  for (const [key, value] of Object.entries({ window: page.window, document: page.window.document, HTMLElement: page.window.HTMLElement, Node: page.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const modules = {
    'next/link': { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children), __esModule: true },
    'next/navigation': { useSearchParams: () => new URLSearchParams(page.window.location.search), usePathname: () => page.window.location.pathname, __esModule: true },
    './use-nearby-sort': { useNearbySort: () => ({ defaultSort: 'recommended', distance: null, origin: null }), NearbySortStatus: () => null },
    '../data/provider-categories': { providerCategories: [{ id: 'all', label: 'הכל' }, { id: 'food', label: 'שפים ואוכל' }, { id: 'music', label: 'מוזיקה' }, { id: 'entertainment', label: 'מופעים ואמנים' }, { id: 'photo', label: 'צילום' }, { id: 'design', label: 'עיצוב' }, { id: 'bar', label: 'ברים' }, { id: 'wellness', label: 'רווחה ותנועה' }], providerCategoryHref: category => category.id === 'all' ? '/providers' : `/providers/${category.id}` },
    '../i18n/locale-routing': { localizedPath: value => value },
    '../lib/provider-search-state': { providerSearchHref: searchState.providerSearchHref, providerCategorySearchHref: searchState.providerCategorySearchHref },
    '../lib/nearby-page-content': { nearbyDefaultSort: () => 'recommended' },
    './discovery-card': { DiscoveryCard: ({ item }) => React.createElement('article', { 'data-card': item.id }, item.name) },
    './modern-select': { ModernSelect: ({ label, value, onChange, options }) => React.createElement('select', { 'aria-label': label, value, onChange: event => onChange(event.target.value) }, options.map(option => React.createElement('option', { key: option.value, value: option.value }, option.label))) },
    './progressive-results': { ProgressiveResults: ({ children, featuredItem }) => React.createElement('div', { className: 'discovery-grid' }, featuredItem, children) },
    '../i18n/locale-provider': { useSiteLanguage: () => ({ language: 'he', translate:value=>value }) },
    './slider-rail-controls': { SliderRailControls: () => null, scrollSliderRailToCard: () => {} },
    './use-document-seed': { useDocumentSeed: () => 'test-seed' },
    '../lib/discovery-result-sort': { discoverySortLabel: () => 'מיון', discoverySortOptions: () => [{ value: 'recommended', label: 'מומלץ' }, { value: 'price', label: 'מחיר' }], numericPriceLabel: () => 1, orderDiscoveryResults: value => value },
    '../lib/provider-service-areas': { providerGeographicServiceAreas: value => value, providerServesRegion: (areas, region) => region === 'כל הארץ' || areas.includes(region) },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { if (name === 'react' || name === 'react/jsx-runtime') return require(name); if (!(name in modules)) throw new Error(`Unstubbed dependency ${name}`); return modules[name]; }, URLSearchParams, window: page.window, document: page.window.document, setTimeout, clearTimeout, console });
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(module.exports.ProviderResults, { items, category: 'all' })));
  return {
    async render(category = 'all') { await act(async () => root.render(React.createElement(module.exports.ProviderResults, { items, category }))); },
    async change(label, value) { await act(async () => { const select = document.querySelector(`select[aria-label="${label}"]`); select.value = value; select.dispatchEvent(new page.window.Event('change', { bubbles: true })); }); },
    async clickCategory(label) { await act(async () => { document.querySelector(`.provider-categories a[href="/providers/${label}"]`)?.click(); }); },
    async close() { await act(async () => root.unmount()); page.window.close(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } },
    links: () => [...document.querySelectorAll('.provider-categories a')],
    location: () => page.window.location.href,
    historyState: () => page.window.history.state,
    filterToggle: () => document.querySelector('.provider-filter-toggle'),
    resetButton: () => document.querySelector('.provider-reset'),
    status: () => document.querySelector('.provider-navigation-status')?.textContent || '',
    sortSelect: () => document.querySelector('select[aria-label="מיון"]'),
  };
}

test('mounted provider results keeps active query, region and sort when category links are rendered', async () => {
  const h = await fixture();
  try {
    assert.equal(h.links().length, 8, 'all plus seven provider topic links must be present');
    const music = h.links().find(link => link.textContent === 'מוזיקה');
    assert.ok(music);
    assert.match(String(music.getAttribute('href')), /\/providers\/music/);
    assert.match(String(music.getAttribute('href')), /q=Liran/);
    assert.match(String(music.getAttribute('href')), /region=/);
    assert.match(String(music.getAttribute('href')), /sort=price/);
  } finally { await h.close(); }
});

test('mounted provider filter controls preserve the current navigation state and reset explicitly', async () => {
  const h = await fixture('https://vii.test/providers?q=Liran&region=מרכז&sort=price');
  try {
    const state = h.historyState();
    await h.change('אזור שירות', 'כל הארץ');
    assert.equal(h.historyState(), state, 'filter URL updates must preserve the framework history state object');
    assert.match(h.location(), /q=Liran/);
    assert.doesNotMatch(h.location(), /region=/);
    assert.match(h.location(), /sort=price/);
  } finally { await h.close(); }
});

test('mounted provider mobile filter toggle exposes its open state', async () => {
  const h = await fixture('https://vii.test/providers');
  try {
    const toggle = h.filterToggle();
    assert.ok(toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    await act(async () => toggle.click());
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    await act(async () => toggle.click());
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  } finally { await h.close(); }
});

test('category activation exposes loading feedback and a committed category closes the mobile filter panel', async () => {
  const h = await fixture('https://vii.test/providers');
  try {
    await act(async () => h.filterToggle().click());
    assert.equal(h.filterToggle().getAttribute('aria-expanded'), 'true');
    await h.clickCategory('music');
    assert.match(h.status(), /טוענים ספקים בתחום שנבחר/);
    await h.render('music');
    assert.equal(h.filterToggle().getAttribute('aria-expanded'), 'false');
    assert.equal(h.status(), '');
  } finally { await h.close(); }
});

test('clearing a sort-only filter returns the default URL and result order controls', async () => {
  const h = await fixture('https://vii.test/providers');
  try {
    await h.change('מיון', 'price');
    assert.equal(h.sortSelect().value, 'price');
    assert.ok(h.resetButton(), 'a non-default sort exposes the reset action');
    await act(async () => h.resetButton().click());
    assert.doesNotMatch(h.location(), /sort=/);
    assert.equal(h.sortSelect().value, 'recommended');
    assert.equal(h.resetButton(), null);
  } finally { await h.close(); }
});
