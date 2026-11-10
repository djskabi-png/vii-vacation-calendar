import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { build } = createRequire(import.meta.resolve('vite'))('esbuild');
const qaRoot = resolve('.qa-output');
mkdirSync(qaRoot, { recursive: true });
const temp = mkdtempSync(join(qaRoot, 'image-metadata-'));
const entry = join(temp, 'entry.ts');
const bundle = join(temp, 'entry.mjs');
writeFileSync(entry, `export { ResponsiveCardImage } from ${JSON.stringify(resolve('app/components/responsive-card-image.tsx'))};
export { DiscoveryThumbnail } from ${JSON.stringify(resolve('app/components/discovery-thumbnail.tsx'))};
export { ResilientImage } from ${JSON.stringify(resolve('app/components/resilient-image.tsx'))};
export { ViewportResilientImage } from ${JSON.stringify(resolve('app/components/viewport-resilient-image.tsx'))};`);
await build({ entryPoints: [entry], outfile: bundle, bundle: true, format: 'esm', platform: 'node', packages: 'external', logLevel: 'silent' });
const actual = await import(pathToFileURL(bundle).href);

const html = (element) => renderToStaticMarkup(element);

test.after(() => rmSync(temp, { recursive: true, force: true }));

test('shared content image wrappers derive a non-empty title from meaningful alt text', () => {
  const responsive = html(React.createElement(actual.ResponsiveCardImage, { src: '/media/place.webp', alt: 'בריכה במקום' }));
  const thumbnail = html(React.createElement(actual.DiscoveryThumbnail, { src: '/media/place.webp', alt: 'בריכה במקום' }));
  const resilient = html(React.createElement(actual.ResilientImage, { src: '/media/place.webp', alt: 'בריכה במקום', onFailure: () => {} }));
  assert.match(responsive, /title="בריכה במקום"/);
  assert.match(thumbnail, /title="בריכה במקום"/);
  assert.match(resilient, /title="בריכה במקום"/);
});

test('explicit custom titles are preserved and decorative metadata stays empty', () => {
  const custom = html(React.createElement(actual.ResilientImage, { src: '/media/place.webp', alt: 'בריכה במקום', title: 'כותרת ערוכה', onFailure: () => {} }));
  const decorative = html(React.createElement(actual.ResponsiveCardImage, { src: '/media/art.webp', alt: '', title: '', 'data-image-role': 'decorative' }));
  assert.match(custom, /title="כותרת ערוכה"/);
  assert.match(decorative, /alt=""/);
  assert.match(decorative, /title=""/);
  assert.match(decorative, /data-image-role="decorative"/);
  const blank = html(React.createElement(actual.ResilientImage, { src: '/media/place.webp', alt: 'בריכה במקום', title: '   ', onFailure: () => {} }));
  assert.match(blank, /title="בריכה במקום"/);
});

test('viewport noscript fallback preserves content alt/title while hidden placeholder remains decorative', () => {
  const rendered = html(React.createElement(actual.ViewportResilientImage, {
    src: '/media/room.webp', alt: 'חדר אירוח', title: 'חדר אירוח', onFailure: () => {}, width: 960, height: 640,
  }));
  assert.match(rendered, /aria-hidden="true"/);
  assert.match(rendered, /<noscript>[\s\S]*alt="חדר אירוח"[\s\S]*title="חדר אירוח"[\s\S]*src="\/media\/room.webp"/);
});
