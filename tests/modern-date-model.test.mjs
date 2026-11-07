import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendarDate, calendarDateKey, calendarDateValidity } from '../app/lib/modern-date-model.ts';

test('calendar accepts real local dates and rejects rollover, malformed and impossible dates', () => {
  for (const value of ['2026-11-07', '2028-02-29', '2026-12-31', '2027-01-01']) assert.equal(calendarDateKey(parseCalendarDate(value)), value);
  for (const value of ['', '2026-02-29', '2026-02-31', '2026-13-01', '2026-00-01', '2026-11-00', '0000-01-01', '2026-1-01', 'abc']) assert.equal(parseCalendarDate(value), null);
});
test('manual input and calendar use identical inclusive boundaries; empty is delegated to required', () => {
  assert.equal(calendarDateValidity('', '2026-11-07', '2026-11-09'), 'valid');
  assert.equal(calendarDateValidity('2026-11-06', '2026-11-07', '2026-11-09'), 'min');
  assert.equal(calendarDateValidity('2026-11-07', '2026-11-07', '2026-11-09'), 'valid');
  assert.equal(calendarDateValidity('2026-11-09', '2026-11-07', '2026-11-09'), 'valid');
  assert.equal(calendarDateValidity('2026-11-10', '2026-11-07', '2026-11-09'), 'max');
  assert.equal(calendarDateValidity('2026-02-31'), 'invalid');
});
