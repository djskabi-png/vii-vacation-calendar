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
    "בחרו תאריכים",
    "כמות אורחים",
    "יחידות אירוח לבחירה",
    "פנוי ויש מחיר",
    "בדיקת זמינות",
    "הזמנה מהירה",
  ]) assert.match(hub, new RegExp(contract));
  assert.match(hub, /role="status" aria-live="polite"/);
  assert.match(hub, /availability\.availability === "unavailable"/);
  assert.match(hub, /state === "available-price"/);
  assert.match(hub, /displayedAvailability\?\.alternatives\?\.length/);
});

test("multi-unit pricing is accepted only from the verified availability resolver", async () => {
  const hub = await readFile(new URL("app/components/vacation-booking-hub.tsx", root), "utf8");
  assert.match(hub, /יש מחיר, הזמינות טרם אושרה/);
  assert.match(hub, /state === "no-data"[\s\S]*title: "התקשרו לבירור זמינות"/);
  assert.match(hub, /state === "unavailable-alternatives"[\s\S]*title: "אין זמינות"/);
  assert.match(hub, /state === "unavailable-price"[\s\S]*title: "אין זמינות"/);
  assert.doesNotMatch(hub, /אין עדיין מידע לזמן הזה/);
  assert.doesNotMatch(hub, /לא פנוי בתאריכים שבחרתם/);
  assert.match(hub, /const rawNightlyPrice = displayedAvailability\?\.nightlyPrice \|\| \(illustrative \|\| property\.demoOperations\?\.fictional \? suppliedPrice : 0\)/);
  assert.match(hub, /const nightlyPrice = rawNightlyPrice/);
  assert.doesNotMatch(hub, /const nightlyPrice = property\.scenario === "single"/);
  assert.doesNotMatch(hub, /property\.scenario === "multi"[^\n]+quickBooking/);
  assert.match(hub, /state === "available-price" && recommendation && recommendation\.unitCount > 1/);
  assert.match(hub, /פנוי בהרכב המומלץ/);
  assert.match(hub, /המחיר המאומת כולל את היחידות שבהמלצה/);
});

test("the booking entry opens one calm responsive dialog with a reachable primary action", async () => {
  const hub = await readFile(new URL("app/components/vacation-booking-hub.tsx", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(hub, /aria-haspopup="dialog"/);
  assert.match(hub, /role="dialog" aria-modal="true"/);
  assert.match(hub, /document\.body\.style\.overflow = "hidden"/);
  assert.match(hub, /window\.removeEventListener\("keydown", closeOnEscape\)/);
  assert.match(css, /\.vacation-booking-dialog \{[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.vacation-booking-dialog \{ width: 100%; height: auto; max-height: 92dvh;/);
  assert.match(css, /\.vacation-booking-dialog__body \{ max-height: calc\(92dvh - 172px\); \}/);
  assert.match(css, /\.vacation-booking-dialog__footer-actions \.button \{[^}]*min-height: 50px/s);
  assert.match(css, /\.vacation-booking-dialog summary:focus-visible/);
  assert.match(css, /body:has\(\.vacation-booking-dialog-layer\) \.detail-sticky-wrap \{ display: none; \}/);
});

test("changing the guest count keeps the mobile booking sheet stable while live availability refreshes", async () => {
  const page = await readFile(new URL("app/business/client-page.tsx", root), "utf8");
  const hub = await readFile(new URL("app/components/vacation-booking-hub.tsx", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(page, /availabilityStatus=\{vacationAvailabilityMode === "live" \? liveLegacyAvailability\.status : vacationAvailabilityMode === "demo" \? "ready" : "idle"\}/);
  assert.match(hub, /aria-busy=\{availabilityLoading\}/);
  assert.match(hub, /availabilityLoading \? <div className="vacation-booking-dialog__status vacation-booking-dialog__status--loading"/);
  assert.match(hub, /מעדכנים זמינות/);
  assert.match(hub, /pendingAvailability/);
  assert.match(hub, /setPendingAvailability\(\{ dateKey, value: availability \}\)/);
  assert.match(hub, /displayedAvailability = availabilityLoading/);
  assert.match(hub, /vacation-booking-dialog__units\$\{availabilityLoading \? " is-updating"/);
  assert.match(hub, /inert=\{availabilityLoading \|\| undefined\}/);
  assert.match(css, /\.vacation-booking-dialog__status--loading > span/);
  assert.match(css, /\.vacation-booking-dialog__units\.is-updating \{ opacity: \.46; \}/);
  assert.match(css, /@media \(max-height: 620px\)[\s\S]*height: 100dvh; max-height: 100dvh;/);
});

test("the availability launcher opens date selection directly when no dates exist", async () => {
  const hub = await readFile(new URL("app/components/vacation-booking-hub.tsx", root), "utf8");
  assert.match(hub, /onClick=\{\(\) => hasDates \? setDialogOpen\(true\) : onOpenCalendar\(\)\}/);
  assert.doesNotMatch(hub, /\{hasDates \? "שינוי" : "בחירה"\}/);
});

test("each multi-unit card exposes its own status price and direct booking action", async () => {
  const hub = await readFile(new URL("app/components/vacation-booking-hub.tsx", root), "utf8");
  assert.match(hub, /<details><summary>פרטי היחידה<\/summary>/);
  assert.match(hub, /room\.features\.slice\(0, 5\)\.join/);
  assert.match(hub, /displayedAvailability\?\.units\?\.find\(\(unit\) => unit\.index === index\)/);
  assert.match(hub, /unitBookingHref\(bookingHref, index, unitNightlyPrice\)/);
  assert.doesNotMatch(hub, /params\.set\("unit", room\.name\)/);
  assert.match(hub, /vacation-booking-dialog__unit-image/);
  assert.match(hub, /vacation-booking-dialog__unit-availability/);
  assert.doesNotMatch(hub, /vacation-booking-unit__features/);
});

test("the selected cabin is preserved in the booking summary", async () => {
  const page = await readFile(new URL("app/booking/page.tsx", root), "utf8");
  const client = await readFile(new URL("app/booking/client-page.tsx", root), "utf8");
  assert.match(page, /unitIndex\?: string/);
  assert.match(page, /const selectedUnit = params\.unitIndex \? property\.roomOptions\?\.\[selectedUnitIndex\] : undefined/);
  assert.match(page, /offerId: selectedUnit \? `unit-\$\{selectedUnitIndex \+ 1\}` : offerId/);
  assert.match(page, /offerName: selectedUnit \? `הזמנת \$\{selectedUnit\.name\}`/);
  assert.doesNotMatch(page, /unit\?: string/);
  assert.match(client, /translate\(props\.offerName\)/);
});
