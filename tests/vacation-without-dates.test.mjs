import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const calendar=read('app/calendar-demo.tsx');
const search=read('app/components/search-box.tsx');
const css=read('app/globals.css');

test('without-date is an enabled localized search-only action on mobile and desktop',()=>{
  assert.match(calendar,/mode === "home" && onSkip && <button[^>]*className="mobile-date-skip calendar-without-dates"[^>]*onClick=\{continueWithoutDates\}[^>]*>\{translate\("ללא תאריך"\)\}/);
  assert.match(css,/\.mobile-date-skip\.calendar-without-dates\s*\{[^}]*display:\s*inline-flex;[^}]*min-height:\s*44px/);
  assert.match(css,/\.calendar-without-dates:focus-visible/);
  assert.deepEqual(JSON.parse(read('app/data/visitor-ui-translations.json'))['ללא תאריך'],{en:'Without dates',fr:'Sans dates',ru:'Без дат'});
});

test('without-date clears both draft and parent exact/flexible choices, not just local highlight',()=>{
  assert.match(calendar,/function continueWithoutDates\(\)\s*\{\s*reset\(\);\s*setFlexible\(false\);\s*onSkip\?\.\(\);/);
  assert.match(calendar,/function reset\(\)\s*\{\s*setCheckIn\(null\);\s*setCheckOut\(null\);/);
  assert.match(search,/<CalendarDemo mode="home"[\s\S]*?onSkip=\{\(\) => \{ setDates\("בחרו תאריכים"\); setVacationDateRange\(\{ from: null, till: null \}\); setVacationFlexibleSearch\(null\); setCalendarOpen\(false\); setMobileStep\("guests"\); setGuestOpen\(true\);/);
  for(const key of ['dates','dateMode','stay','month','flexDays','from','till']) assert.ok(search.includes(`params.delete("${key}")`),`remove ${key}`);
});

test('clearing dates preserves online filter on clean regional routes as well as general search',()=>{
  const clean=search.slice(search.indexOf('} else if (mode === "vacation" && cleanVacationRoute)'),search.indexOf('} else {',search.indexOf('} else if (mode === "vacation" && cleanVacationRoute)')));
  assert.match(clean,/get\("online"\) === "1"\) params.set\("online", "1"\)/);
  assert.match(clean,/applyVacationDates\(params\)/);
  for(const field of ['adults','children','infants','pets','rooms']) assert.ok(clean.includes(`params.set("${field}"`),`${field} retained`);
});
