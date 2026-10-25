import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const business = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const vacationHub = await readFile(new URL("../app/components/vacation-booking-hub.tsx", import.meta.url), "utf8");
const booking = await readFile(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8");
const bookingPage = await readFile(new URL("../app/booking/page.tsx", import.meta.url), "utf8");
const businessPage = await readFile(new URL("../app/business/page.tsx", import.meta.url), "utf8");
const homeDeals = await readFile(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
const stayQuoteHook = await readFile(new URL("../app/components/use-vii-stay-quote.ts", import.meta.url), "utf8");
const dealStatus = await readFile(new URL("../app/components/home-deal-detail-status.tsx", import.meta.url), "utf8");
const localeProvider = await readFile(new URL("../app/i18n/locale-provider.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("vacation online booking requires dates and a positive connected price", () => {
  assert.match(business, /hasSelectedDates = Boolean\(dateRange\.from && dateRange\.till\)/);
  assert.match(business, /hasSelectedPrice = Boolean\(resolvedSelectedPrice && Number\(resolvedSelectedPrice\) > 0\)/);
  assert.match(business, /vacationOnlineReady = activeWorld === "vacation" && vacationAvailabilityMode !== "inquiry" && hasSelectedDates && effectiveVacationAvailability\?\.availability === "available" && hasSelectedPrice && \(!supplierSiteID \|\| supplierQuote\.onlineBooking && supplierQuote\.roomIDs\.length === 1/);
  assert.match(business, /bookingEnabled=\{!supplierSiteID \|\| supplierQuote\.onlineBooking && Boolean\(verifiedSupplierRoomID\)\}/);
  assert.match(booking, /supplierBookingReady = Boolean\(supplierSiteID && supplierQuote\.status === "ready" && supplierQuote\.roomIDs\.length === 1/);
  assert.match(booking, /supplierQuote\.roomIDs\.includes\(props\.supplierRoomID\)/);
  assert.match(business, /property\.demoOperations\?\.fictional \|\| effectiveVacationAvailability\?\.illustrative \? \{ illustrative: "1" \} : \{\}/);
  assert.match(bookingPage, /onlineReady: property\.capacityScope !== "unit" && Boolean\(params\.from && params\.till && nightlyPrice > 0\)/);
  assert.match(bookingPage, /nightlyPrice = property\.capacityScope === "unit" \|\| \/\^vacation-\\d\+\$\/\.test\(property\.slug\) \? 0 : Number\(params\.price\) \|\| 0/);
  assert.match(bookingPage, /if \(property\) \{[\s\S]*?return \{[\s\S]*?world: "vacation"/);
  assert.doesNotMatch(booking, /onlineReady\s*=\s*isManage\s*\|\|/);
});

test("incomplete vacation data keeps availability date-first and preserves the booking phone fallback", () => {
  assert.match(business, /vacationPhoneFallback = activeWorld === "vacation" && !vacationOnlineReady/);
  assert.match(vacationHub, /בחרו תאריכים כדי לראות זמינות ומחיר/);
  assert.match(vacationHub, /"בחירת תאריכים"/);
  assert.doesNotMatch(business, /phoneRevealed \? <a className="phone-reveal phone-reveal--visible"/);
  assert.match(booking, /if \(!onlineReady\)/);
  assert.match(booking, /<DirectPhoneLink phone=\{props.phone\}/);
  assert.doesNotMatch(booking, /phoneRevealed|לחצו להצגת המספר/);
  assert.match(booking, /placement: "booking_phone_fallback"/);
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
  assert.match(business, /vacationOnlineReady = activeWorld === "vacation" && vacationAvailabilityMode !== "inquiry" && hasSelectedDates && effectiveVacationAvailability\?\.availability === "available" && hasSelectedPrice/);
  assert.match(vacationHub, />הזמנה מהירה<\/Link>/);
  assert.match(business, /ownerWhatsapp \? <WhatsAppLeadButton world=\{activeWorld\}/);
  assert.match(business, /phoneHref \? <DirectPhoneLink/);
  assert.doesNotMatch(business, /setPhoneRevealed|phoneRevealed/);
  assert.match(business, /className="property-phone-action" tracking=/);
  assert.doesNotMatch(business, /בדיקת זמינות לחיפוש הזה/);
  assert.match(vacationHub, /buttonLabel=\{bookingEnabled \? "בדיקת זמינות" : "פנייה להזמנה"\}/);
  assert.match(vacationHub, /state === "available-price"/);
});

test("last-minute entry highlights its source room but rechecks the whole property before checkout", () => {
  assert.match(homeDeals, /deal\.roomID \? \{ roomID: String\(deal\.roomID\) \} : \{\}/);
  assert.match(businessPage, /initialRoomID=\{params\.roomID\}/);
  assert.match(business, /highlightedSupplierRoomID[\s\S]*property page must re-evaluate the whole complex/);
  assert.match(business, /useViiStayQuote\(supplierSiteID \? Number\(supplierSiteID\) : null, dateRange\.from, dateRange\.till, guests, supplierRooms\)/);
  assert.match(business, /assessCalendarStay\(supplierCalendar\.calendar, dateRange\.from, dateRange\.till\)/);
  assert.match(business, /supplierAvailableRoomIDs = supplierCalendarStay\?\.allowed \? supplierCalendarStay\.roomIDs/);
  assert.match(business, /היחידה שממנה הגעתם · כל יחידות המתחם נבדקות/);
  assert.doesNotMatch(business, /useViiStayQuote\([^\n]*highlightedSupplierRoomID/);
  assert.match(stayQuoteHook, /\.\.\.\(roomID \? \{ roomID \} : \{\}\)/);
  assert.match(booking, /useViiStayQuote\([\s\S]*props\.supplierRoomID\)/);
  assert.match(business, /onlineHref=\{activeWorld === "vacation" \? "#booking-summary"/);
});

test("deal status does not promise an online action independently of quote readiness", () => {
  assert.doesNotMatch(dealStatus, /אפשר להמשיך להזמנה באתר|You can continue to booking/);
  assert.match(dealStatus, /החדר אינו נשמר עד לסיום ההזמנה/);
});
