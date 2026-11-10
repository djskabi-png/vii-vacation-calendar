import test from 'node:test';
import assert from 'node:assert/strict';
import { createMapTileHealth } from '../app/lib/map/map-tile-health.ts';

function fakeTimers() {
  let next = 0; const callbacks = new Map();
  return {
    timers: { setTimeout: (callback) => { const id = ++next; callbacks.set(id, callback); return id; }, clearTimeout: (id) => callbacks.delete(id) },
    fire() { for (const callback of callbacks.values()) callback(); callbacks.clear(); },
  };
}

test('street failure followed by aerial success becomes ready', () => {
  const clock = fakeTimers(); const events = [];
  const health = createMapTileHealth(() => events.push('ready'), (error) => events.push(error.message), 2200, clock.timers);
  health.markFailed('street'); health.markLoaded('aerial'); assert.deepEqual(events, []); health.complete('aerial');
  assert.deepEqual(events, ['ready']);
});

test('both approved layers failing produces a retryable provider failure', () => {
  const clock = fakeTimers(); const events = [];
  const health = createMapTileHealth(() => events.push('ready'), (error) => events.push(error.message), 12000, clock.timers);
  health.complete('street'); health.complete('aerial');
  assert.equal(events.at(-1), 'Both approved map tile layers failed to load.');
});

test('late street completion after an error cannot report a false success', () => {
  const clock = fakeTimers(); const events = [];
  const health = createMapTileHealth(() => events.push('ready'), (error) => events.push(error.message), 12000, clock.timers);
  health.markFailed('street'); health.markLoaded('street'); health.complete('street'); assert.deepEqual(events, []); health.complete('aerial');
  assert.deepEqual(events, ['Both approved map tile layers failed to load.']);
});

test('partial aerial success waits for layer completion instead of showing a mostly blank map', () => {
  const clock = fakeTimers(); const events = [];
  const health = createMapTileHealth(() => events.push('ready'), (error) => events.push(error.message), 12000, clock.timers);
  health.markLoaded('aerial'); assert.deepEqual(events, []); health.complete('aerial');
  assert.deepEqual(events, ['ready']);
});

test('disposed tile health ignores late callbacks', () => {
  const clock = fakeTimers(); const events = [];
  const health = createMapTileHealth(() => events.push('ready'), (error) => events.push(error.message), 12000, clock.timers);
  health.dispose(); health.markLoaded('street'); health.complete('aerial'); clock.fire();
  assert.deepEqual(events, []);
});

test('bounded tile timeout never reports ready and is cleaned up', () => {
  const clock = fakeTimers(); const events = [];
  const health = createMapTileHealth(() => events.push('ready'), (error) => events.push(error.message), 2200, clock.timers);
  clock.fire();
  assert.deepEqual(events, ['Map tiles did not become available before the bounded readiness deadline.']);
  health.dispose();
});
