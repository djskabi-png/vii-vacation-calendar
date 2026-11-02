import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const hub = readFileSync(new URL("../app/components/vacation-booking-hub.tsx", import.meta.url), "utf8");

test("a supplier without an online calendar is routed to the contact-only mode", () => {
  assert.match(business, /\(supplierSiteID && property\.onlineAvailability === true\) \|\| usesLiveLegacyAvailability\) \? "live"/);
  assert.match(business, /phone=\{property\.contact\?\.phone\}/);
});

test("contact-only mode replaces date editing with clear phone and WhatsApp actions", () => {
  assert.match(hub, /if \(availabilityMode === "inquiry"\) return <section/);
  assert.match(hub, /המקום אינו מנהל יומן הזמנות מקוון/);
  assert.match(hub, /label=\{inquiryCopy\.call\}/);
  assert.match(hub, /buttonLabel=\{inquiryCopy\.whatsapp\}/);
  const inquiryStart = hub.indexOf('if (availabilityMode === "inquiry") return <section');
  const regularLauncher = hub.indexOf('className={`vacation-booking-hub__launcher', inquiryStart);
  assert.ok(inquiryStart >= 0 && regularLauncher > inquiryStart, "contact-only return must precede the date launcher");
});

test("contact-only unit cards never inherit a positive availability state", () => {
  assert.match(business, /const roomAvailable = vacationAvailabilityMode !== "inquiry" &&/);
  assert.match(business, /const roomUnavailable = vacationAvailabilityMode !== "inquiry" &&/);
  const statusStart = business.indexOf("const roomStatus = vacationAvailabilityMode");
  const positiveStatus = business.indexOf('"יש זמינות בתאריכים שבחרתם"', statusStart);
  assert.ok(statusStart >= 0 && positiveStatus > statusStart, "inquiry state must be resolved before any positive availability copy");
  assert.match(business, /vacationAvailabilityMode === "inquiry"[\s\S]*?\? unitCopy\.inquiry[\s\S]*?: availableIdenticalUnits/);
});

test("every vacation WhatsApp action reuses the green card action", () => {
  assert.match(hub, /buttonClassName="stay-card__contact stay-card__contact--whatsapp vacation-booking-hub__inquiry-whatsapp"/);
  assert.match(hub, /buttonClassName="stay-card__contact stay-card__contact--whatsapp vacation-booking-dialog__whatsapp"/);
  assert.match(business, /buttonLabel=\{translate\("שלחו הודעה בוואטסאפ"\)\} buttonClassName="stay-card__contact stay-card__contact--whatsapp"/);
  assert.doesNotMatch(business, /buttonLabel=\{unitCopy\.enquire\} buttonClassName="button primary"/);
});
