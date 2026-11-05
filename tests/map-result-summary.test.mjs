import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapResultSummary } from '../app/lib/map-result-summary.ts';

test('regional trail markers count represented trails rather than marker groups', () => {
  assert.deepEqual(mapResultSummary([{representedCount:6},{representedCount:3}], 'he', 'trails'), {
    count:9, markers:2, trailLabel:'מסלולים', approximateLabel:'אזור משוער'
  });
});

test('all supported trail locales describe approximation without a booking promise', () => {
  for (const [language, label] of [['he','מסלולים'],['en','trails'],['ru','маршрутов'],['fr','itinéraires']]) {
    const summary=mapResultSummary([{representedCount:6}],language,'trails');
    assert.equal(summary.trailLabel,label);
    assert.equal(summary.count,6);
    assert.doesNotMatch(summary.approximateLabel,/confirm|arrival|אישור/i);
  }
});

test('ordinary places retain one result per marker and invalid aggregates cannot corrupt totals', () => {
  const summary=mapResultSummary([{}, {representedCount:0}, {representedCount:-2}, {representedCount:NaN}, {representedCount:1.5}], 'he');
  assert.equal(summary.count,5);
  assert.equal(summary.trailLabel,null);
  assert.equal(mapResultSummary([], 'en', 'trails').count,0);
});
