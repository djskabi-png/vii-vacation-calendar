import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bookingPage = fs.readFileSync(new URL("../app/booking/page.tsx", import.meta.url), "utf8");
const bookingClient = fs.readFileSync(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8");
const siteData = fs.readFileSync(new URL("../app/data/site-data.ts", import.meta.url), "utf8");

test("vacation booking treats the query price as a nightly rate and calculates the whole stay", () => {
  assert.match(bookingPage, /const totalPrice = nightlyPrice > 0 && nights > 0 \? nightlyPrice \* nights : 0/);
  assert.match(bookingPage, /nightlyPrice,/);
  assert.match(bookingPage, /totalPrice,/);
});

test("booking price summary states nightly rate, nights, party scope, and tax status", () => {
  assert.match(bookingClient, /סה״כ לכל השהייה/);
  assert.match(bookingClient, /ללילה/);
  assert.match(bookingClient, /כל הווילה/);
  assert.match(bookingClient, /כולל מע״מ וכל מס חובה/);
  assert.match(bookingClient, /props\.vacationPrice\.nightlyPrice \* currentNights/);
});

test("Villa Palumbo demo explicitly defines mandatory taxes as included", () => {
  assert.match(siteData, /weekendNightlyPrice: 3200,[\s\S]*?taxesIncluded: true/);
});
