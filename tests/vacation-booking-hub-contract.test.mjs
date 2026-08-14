import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("vacation detail pages keep booking connected while showing the verified units in the page", async () => {
  const page = await readFile(new URL("app/business/client-page.tsx", root), "utf8");
  const hub = await readFile(new URL("app/components/vacation-booking-hub.tsx", root), "utf8");
  assert.match(page, /<VacationBookingHub/);
  assert.match(page, /property\.roomOptions\?\.length \? <section id="rooms"/);
  assert.match(hub, /<section id="booking-summary"/);
  assert.match(page, /activeWorld === "vacation" \? null :/);
  assert.match(page, /resolvedSelectedPrice/);
});

test("the booking hub keeps dates guests availability units price and action in one section", async () => {
  const hub = await readFile(new URL("app/components/vacation-booking-hub.tsx", root), "utf8");
  for (const contract of [
    "תאריכי השהייה",
    "כמות אורחים",
    "יחידות אירוח לבחירה",
    "פנוי ויש מחיר",
    "בדיקת זמינות",
    "הזמנה מהירה",
  ]) assert.match(hub, new RegExp(contract));
  assert.match(hub, /role="status" aria-live="polite"/);
  assert.match(hub, /availability\.availability === "unavailable"/);
  assert.match(hub, /state === "available-price"/);
  assert.match(hub, /availability\?\.alternatives\?\.length/);
});

test("unknown multi-unit availability is not presented as verified per-unit availability", async () => {
  const hub = await readFile(new URL("app/components/vacation-booking-hub.tsx", root), "utf8");
  assert.match(hub, /יש מחיר, הזמינות טרם אושרה/);
  assert.match(hub, /אין עדיין מידע לזמן הזה/);
  assert.match(hub, /const nightlyPrice = property\.scenario === "single" \? rawNightlyPrice : 0/);
  assert.doesNotMatch(hub, /property\.scenario === "multi"[^\n]+quickBooking/);
});

test("the booking entry opens one calm responsive dialog with a reachable primary action", async () => {
  const hub = await readFile(new URL("app/components/vacation-booking-hub.tsx", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(hub, /aria-haspopup="dialog"/);
  assert.match(hub, /role="dialog" aria-modal="true"/);
  assert.match(hub, /document\.body\.style\.overflow = "hidden"/);
  assert.match(hub, /window\.removeEventListener\("keydown", closeOnEscape\)/);
  assert.match(css, /\.vacation-booking-dialog \{[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.vacation-booking-dialog \{ width: 100%; max-height: 92dvh;/);
  assert.match(css, /\.vacation-booking-dialog__footer-actions \.button \{[^}]*min-height: 50px/s);
  assert.match(css, /\.vacation-booking-dialog summary:focus-visible/);
  assert.match(css, /body:has\(\.vacation-booking-dialog-layer\) \.detail-sticky-wrap \{ display: none; \}/);
});

test("secondary unit information stays behind disclosure and large repeated media is omitted", async () => {
  const hub = await readFile(new URL("app/components/vacation-booking-hub.tsx", root), "utf8");
  assert.match(hub, /<details><summary>מה כלול<\/summary>/);
  assert.match(hub, /room\.features\.slice\(0, 5\)\.join/);
  assert.doesNotMatch(hub, /<img/);
  assert.doesNotMatch(hub, /vacation-booking-unit__features/);
});
