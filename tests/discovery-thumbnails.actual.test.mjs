import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { generateDiscoveryThumbnails } from '../scripts/generate-discovery-thumbnails.mjs';

const sharp = createRequire(import.meta.resolve('next'))('sharp');
const manifest = JSON.parse(readFileSync('app/data/discovery-thumbnails.generated.json', 'utf8'));
const qa = resolve('.qa-output'); mkdirSync(qa, { recursive: true });
const dir = mkdtempSync(join(qa, 'thumbnail-actual-'));
const entry = join(dir, 'entry.ts'), bundle = join(dir, 'entry.mjs');
writeFileSync(entry, "export{DiscoveryThumbnail}from'../../app/components/discovery-thumbnail.tsx';");
await createRequire(import.meta.resolve('vite'))('esbuild').build({ entryPoints: [entry], outfile: bundle, bundle: true, format: 'esm', platform: 'node', packages: 'external', logLevel: 'silent' });
const { DiscoveryThumbnail } = await import(pathToFileURL(bundle).href);
test.after(() => { assert.ok(dir.startsWith(qa + '\\') || dir.startsWith(qa + '/')); rmSync(dir, { recursive: true, force: true }); });

test('every discovery derivative matches its unchanged original, fits 3x tiles, and is materially smaller', async () => {
  const checked = await generateDiscoveryThumbnails();
  assert.ok(checked.count >= 15);
  assert.ok(checked.bytes < checked.sourceBytes * .15);
  for (const [source, row] of Object.entries(manifest.entries)) {
    const original = readFileSync(resolve('public', '.' + source));
    const preview = readFileSync(resolve('public', '.' + row.src));
    assert.equal(createHash('sha256').update(original).digest('hex'), row.sourceSha256);
    assert.equal(createHash('sha256').update(preview).digest('hex'), row.sha256);
    const image = await sharp(preview).metadata();
    const sourceImage = await sharp(original).metadata();
    assert.equal(image.format, 'webp');
    assert.equal(image.width, Math.min(192, sourceImage.width));
    assert.equal(image.width, row.width);
    assert.equal(image.height, row.height);
    assert.match(row.src, /^\/assets\/vii-thumbnail-[a-f0-9]{20}\.webp$/);
  }
});

test('actual React thumbnail falls back once, keeps labels, resets for a different photo, and preserves unknown CMS sources', async () => {
  const page = new JSDOM('<div id="root"></div>', { url: 'https://vii.test/' });
  const before = new Map();
  for (const [key, value] of Object.entries({ window: page.window, document: page.window.document, HTMLElement: page.window.HTMLElement, Node: page.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) {
    before.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(document.getElementById('root'));
  const [first, second] = Object.keys(manifest.entries);
  let failures = 0;
  const render = src => root.render(React.createElement(DiscoveryThumbnail, { src, alt: 'same real photograph', title: 'original label', loading: 'lazy', onError: () => failures++ }));
  try {
    await act(async () => render(first));
    let image = document.querySelector('img');
    assert.equal(image.getAttribute('src'), manifest.entries[first].src);
    assert.equal(image.alt, 'same real photograph');
    assert.equal(image.title, 'original label');
    await act(async () => image.dispatchEvent(new page.window.Event('error')));
    assert.equal(image.getAttribute('src'), first);
    assert.equal(failures, 0);
    await act(async () => image.dispatchEvent(new page.window.Event('error')));
    assert.equal(failures, 1);
    assert.equal(image.getAttribute('src'), first);
    await act(async () => render(second));
    assert.equal(document.querySelector('img').getAttribute('src'), manifest.entries[second].src);
    await act(async () => render('/media/new-cms-photo.jpg'));
    assert.equal(document.querySelector('img').getAttribute('src'), '/media/new-cms-photo.jpg');
  } finally {
    await act(async () => root.unmount()); page.window.close();
    for (const [key, descriptor] of before) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
