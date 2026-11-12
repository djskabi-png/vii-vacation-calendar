import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { navigationProgressCriticalCss } from '../app/components/navigation-progress-style.ts';

test('navigation feedback keeps its complete styling without a blocking CSS import', () => {
  assert.ok(Buffer.byteLength(navigationProgressCriticalCss) < 2048);
  for (const selector of ['.navigation-progress{', '.navigation-progress__label{', '.navigation-progress.is-active,html[data-navigation-pending="true"] .navigation-progress{', '@keyframes navigation-progress-run', '@media(prefers-reduced-motion:reduce)']) {
    assert.ok(navigationProgressCriticalCss.includes(selector), selector);
  }
  const component = readFileSync('app/components/navigation-progress.tsx', 'utf8');
  assert.doesNotMatch(component, /import\s+["'][^"']+\.css["']/);
  assert.ok(component.includes('recoverStalledNavigation'));
});

test('actual built public HTML carries navigation CSS in its head without an external render blocker', async () => {
  const { default: worker } = await import('../dist/server/index.js');
  for (const path of ['/', '/vacations/kinneret?guests=2', '/events', '/spas', '/hourly']) {
    const response = await worker.fetch(new Request('https://vii.spaplus.co' + path, { headers: { Accept: 'text/html' } }),
      { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } },
      { waitUntil(promise) { promise.catch(() => {}); }, passThroughOnException() {} });
    assert.equal(response.status, 200, path);
    const document = new JSDOM(await response.text()).window.document;
    assert.equal(document.head.querySelector('#vii-navigation-progress-critical')?.textContent, navigationProgressCriticalCss, path);
    assert.equal([...document.querySelectorAll('link[rel=stylesheet]')].filter(link => /\/navigation-progress-[^/]+\.css/.test(link.getAttribute('href') || '')).length, 0, path);
    assert.ok(document.querySelector('h1'), path + ' retains actual content');
  }
});
