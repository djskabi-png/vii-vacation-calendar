import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const css = read('app/mobile-polish.css');

test('stacked depth-topic placement is scoped away from home image cards', () => {
  assert.doesNotMatch(css, /\.site-page \.search-depth__discovery-card :is\(strong,small\)\s*\{/);
  assert.doesNotMatch(css, /\.site-page \.search-depth__discovery-icon\s*\{/);
  assert.match(css, /\.site-page \.search-depth__related \.search-depth__discovery-card :is\(strong,small\)\s*\{[^}]*grid-column:1/);
});

test('home cards explicitly reserve flexible text and an independent arrow area', () => {
  assert.match(css, /grid-template-columns:64px minmax\(0,1fr\) 16px;[^}]*grid-template-areas:"media label arrow" "media note arrow"/);
  for (const area of ['media', 'label', 'note', 'arrow']) assert.ok(css.includes(`grid-area:${area};`));
  assert.match(css, /\.home-managed-discovery__track \.search-depth__discovery-arrow\s*\{[^}]*position:static/);
  assert.match(css, /\.home-managed-discovery__track \.search-depth__discovery-card:focus-visible\s*\{[^}]*outline:/);
});

test('homepage-specific stylesheet does not undo bounded category card width', () => {
  const home = read('app/home-mobile.css');
  assert.match(home, /\.home-managed-discovery__track\.search-depth__rail\s*\{ grid-auto-columns:min\(88%,320px\)/);
  assert.doesNotMatch(home, /\.home-managed-discovery__track\.search-depth__rail\s*\{ grid-auto-columns:100%/);
  const component = read('app/components/home-discovery-sections.tsx');
  for (const preserved of ['localizedPath(item.href, language)', 'HomeSliderControls', 'item.imageAlt || item.label', 'data-horizontal-rail']) assert.ok(component.includes(preserved));
});
