import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { recoverRouteBoundaryOnce } from '../app/lib/navigation-recovery.ts';

const progressSource = fs.readFileSync(new URL('../app/components/navigation-progress.tsx', import.meta.url), 'utf8');
const progressCss = fs.readFileSync(new URL('../app/components/navigation-progress-style.ts', import.meta.url), 'utf8');
const warmupSource = fs.readFileSync(new URL('../app/components/smart-navigation-warmup.tsx', import.meta.url), 'utf8');
const errorSource = fs.readFileSync(new URL('../app/error.tsx', import.meta.url), 'utf8');
const globalErrorSource = fs.readFileSync(new URL('../app/global-error.tsx', import.meta.url), 'utf8');

test('route error recovery is reserved once per pathname and never loops', () => {
  const values = new Map();
  const scheduled = [];
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const recover = now => recoverRouteBoundaryOnce({
    currentHref: 'https://vii.spaplus.co/events?area=north',
    now,
    storage,
    schedule: callback => scheduled.push(callback),
    reset: () => scheduled.push('reset'),
  });
  assert.equal(recover(100_000), true);
  assert.equal(recover(100_001), false);
  assert.equal(scheduled.length, 1);
  scheduled[0]();
  assert.deepEqual(scheduled, [scheduled[0], 'reset']);
  assert.equal(recover(160_001), true);
});

test('storage denial blocks automatic recovery instead of risking a reset loop', () => {
  let reset = false;
  assert.equal(recoverRouteBoundaryOnce({
    currentHref: 'https://vii.spaplus.co/spas',
    now: 100_000,
    storage: { getItem: () => { throw new Error('denied'); }, setItem: () => undefined },
    schedule: callback => callback(),
    reset: () => { reset = true; },
  }), false);
  assert.equal(reset, false);
});

test('navigation feedback is immediate, localized, accessible and explicitly finishable', () => {
  assert.match(progressSource, /dataset\.navigationPending = "true"/);
  assert.match(progressSource, /delete document\.documentElement\.dataset\.navigationPending/);
  assert.match(progressSource, /window\.addEventListener\(NAVIGATION_END_EVENT, finish\)/);
  assert.match(progressSource, /role="status"/);
  assert.match(progressSource, /aria-live="polite"/);
  for (const language of ['he', 'en', 'ru', 'fr']) assert.match(progressSource, new RegExp(`${language}: \\[`));
  assert.match(progressCss, /position:fixed;z-index:10050;inset:0/);
  assert.match(progressCss, /prefers-reduced-motion:reduce/);
});

test('primary worlds are prefetched and route failures show recovery before terminal error', () => {
  for (const route of ['"/events"', '"/spas"', '"/hourly"']) assert.ok(warmupSource.includes(route));
  assert.match(warmupSource, /router\.prefetch\(destination\)/);
  assert.match(errorSource, /if \(recovering\) return <main className="route-recovery-loading"/);
  assert.match(errorSource, /recoverRouteBoundaryOnce/);
  assert.match(errorSource, /fallbackTimer = window\.setTimeout\(stopRecovering, 3_500\)/);
  assert.match(errorSource, /role="alert"/);
  assert.match(globalErrorSource, /if \(recovering\) return <html/);
  assert.match(globalErrorSource, /recoverRouteBoundaryOnce/);
  assert.match(globalErrorSource, /route-recovery-loading/);
});
