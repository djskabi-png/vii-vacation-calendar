import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const business = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const vacationHub = await readFile(new URL("../app/components/vacation-booking-hub.tsx", import.meta.url), "utf8");
const booking = await readFile(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8");
const bookingPage = await readFile(new URL("../app/booking/page.tsx", import.meta.url), "utf8");
const localeProvider = await readFile(new URL("../app/i18n/locale-provider.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("vacation online booking requires dates and a positive connected price", () => {
  assert.match(business, /hasSelectedDates = Boolean\(dateRange\.from && dateRange\.till\)/);
  assert.match(business, /hasSelectedPrice = Boolean\(resolvedSelectedPrice && Number\(resolvedSelectedPrice\) > 0\)/);
  assert.match(business, /vacationOnlineReady = activeWorld === "vacation" && hasSelectedDates && resolvedAvailability\?\.availability === "available" && hasSelectedPrice/);
  assert.match(bookingPage, /onlineReady: Boolean\(params\.from && params\.till && params\.price && Number\(params\.price\) > 0\)/);
  assert.match(bookingPage, /if \(property\) \{[\s\S]*?return \{[\s\S]*?world: "vacation"/);
  assert.doesNotMatch(booking, /onlineReady\s*=\s*isManage\s*\|\|/);
});

test("incomplete vacation data keeps availability date-first and preserves the booking phone fallback", () => {
  assert.match(business, /vacationPhoneFallback = activeWorld === "vacation" && !vacationOnlineReady/);
  assert.match(vacationHub, /בחרו תאריכים כדי לראות זמינות ומחיר/);
  assert.match(vacationHub, /"בחירת תאריכים"/);
  assert.doesNotMatch(business, /phoneRevealed \? <a className="phone-reveal phone-reveal--visible"/);
  assert.match(booking, /if \(!onlineReady\)/);
  assert.match(booking, /phoneRevealed \? <a className="phone-reveal phone-reveal--visible"/);
  assert.match(booking, /setPhoneRevealed\(true\)/);
});

test("spa booking adds payment choice, safe hosted-payment preview and thank-you summary", () => {
  assert.match(booking, /שלב 1 מתוך 3/);
  assert.match(booking, /שלב 2 מתוך 3/);
  assert.match(booking, /שלב 3 מתוך 3/);
  assert.match(booking, /תשלום בכרטיס אשראי עכשיו/);
  assert.match(booking, /תשלום במקום/);
  assert.match(booking, /כרטיס לביטחון/);
  assert.match(booking, /booking-payment-dialog/);
  assert.match(booking, /המחשה בלבד/);
  assert.match(booking, /requestSubmit/);
  assert.match(booking, /booking-payment-dialog--success/);
  assert.match(booking, /בקשת ההזמנה הושלמה/);
  assert.doesNotMatch(booking, /name="(?:cardNumber|expiry|cvv|cvc)"|autoComplete="cc-/iu);
});
test("booking UI has responsive step, review, phone and safe mobile rules", () => {
  for (const selector of [".booking-steps", ".booking-form--steps", ".booking-review", ".phone-reveal", ".booking-unavailable", ".booking-payment-choice", ".booking-payment-dialog"]) assert.match(css, new RegExp(selector.replace(".", "\\.")));
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.booking-flow--steps \{ grid-template-columns: 1fr/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.spa-appointment__participants > \.spa-appointment__composition \{ grid-column: 1 \/ -1/);
  assert.doesNotMatch(css, /\.spa-appointment__participants \{[^}]*minmax\(300px/);
});

test("spa package includes are localized item by item", () => {
  assert.match(booking, /const \{ language, translate \} = useSiteLanguage\(\)/);
  assert.match(booking, /props\.offerIncludes\?\.map\(\(item\) => translate\(item\)\)/);
  assert.match(booking, /localizedOfferIncludes\.join\(" · "\)/);
  assert.match(localeProvider, /value\.split\(\/\\s\*\[\\u00b7\\u2022\]\\s\*\/\)/);
  assert.match(localeProvider, /translateValue\(part, language\)\.trim\(\)/);
});


test("bookable vacation uses one quick-book action while incomplete data keeps direct enquiry", () => {
  assert.match(business, /vacationOnlineReady = activeWorld === "vacation" && hasSelectedDates && resolvedAvailability\?\.availability === "available" && hasSelectedPrice/);
  assert.match(vacationHub, />הזמנה מהירה<\/Link>/);
  assert.match(business, /ownerWhatsapp \? <WhatsAppLeadButton world=\{activeWorld\}/);
  assert.match(business, /phoneHref \? phoneRevealed/);
  assert.match(business, /setPhoneRevealed\(true\)/);
  assert.match(business, /<a className="property-phone-action property-phone-action--revealed" href=\{phoneHref\}/);
  assert.doesNotMatch(business, /בדיקת זמינות לחיפוש הזה/);
  assert.match(vacationHub, /buttonLabel="בדיקת זמינות"/);
  assert.match(vacationHub, /state === "available-price"/);
});
