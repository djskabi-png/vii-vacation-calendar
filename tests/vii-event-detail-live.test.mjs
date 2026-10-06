import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const detail = await readFile(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8");

test("event detail checks the selected date, party and duration through supplier search", () => {
  assert.match(detail, /useViiLiveSearch\("events", eventDate && Number\(eventGuests\) > 0 \? eventDate : null, eventDate && Number\(eventGuests\) > 0 \? eventDate : null, Number\(eventGuests\), eventHours\)/);
  assert.match(detail, /supplierResult\?\.available === true && supplierResult\.total && supplierResult\.start/);
  assert.match(detail, /supplierResult\?\.reason === "no_prices"/);
  assert.match(detail, /supplierResult\?\.reason === "no_availability"/);
  assert.match(detail, /זו בקשת בירור בלבד\. אין חיוב או אישור הזמנה/);
});
