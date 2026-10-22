import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const bookingHub = readFileSync(new URL("../app/components/vacation-booking-hub.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("owner's public business phone is visible immediately through shared direct dialing", () => {
  assert.doesNotMatch(business, /phoneRevealed|setPhoneRevealed|הצגת מספר/);
  assert.match(business, /<DirectPhoneLink phone=\{property.contact\?\.phone\}/);
  assert.match(business, /className="property-phone-action"/);
  assert.match(business, /placement: "property_detail"/);
});

test("date launcher uses one clear mobile hierarchy", () => {
  assert.match(bookingHub, />בחרו תאריכים<\/strong>/);
  assert.match(bookingHub, /"בדיקת זמינות"/);
  assert.match(bookingHub, /\{hasDates \? <span className="vacation-booking-hub__launcher-action">עריכה<\/span> : null\}/);
  assert.doesNotMatch(bookingHub, />בחירה<\/span>/);
  assert.doesNotMatch(bookingHub, /vacation-booking-hub__launcher-action-short/);
  assert.doesNotMatch(bookingHub, />פירוט<\/span>/);
});

test("mobile amenities stay short until the visitor expands them", () => {
  assert.match(business, /<h2>מתקנים ושירותים<\/h2>/);
  assert.match(business, /localizedBusinessList\(mobileFeaturePreview, language, translate\)\.map/);
  assert.match(business, /hidden=\{!mobileFeaturesOpen\}/);
  assert.match(business, /"הצגת כל המתקנים"/);
  assert.match(styles, /\.feature-section__mobile-groups\[hidden\] \{ display: none; \}/);
  assert.doesNotMatch(business, /<h2>מה מחכה לכם במקום<\/h2>/);
});

test("vacation units and verified bedrooms remain separate visible sections", () => {
  assert.doesNotMatch(business, /"המקום שמזמינים"/);
  assert.doesNotMatch(business, /property\.scenario === "single" \? "פרטי המקום"/);
  assert.doesNotMatch(business, /property\.scenario === "single" \? "מקום אירוח שלם"/);
  assert.match(business, /<section id="rooms" className="units-section" aria-labelledby="units-heading-title">/);
  assert.match(business, /property\.scenario === "multi" \? "הסוויטות והיחידות" : "מבנה המקום"/);
  assert.match(business, /property\.scenario === "multi" \? \(roomQuantity === 1/);
  assert.match(business, /"המקום כולו עומד לרשותכם"/);
  assert.match(business, /room\.featureGroups/);
  assert.match(business, /isVerifiedBedroomGroup/);
  assert.match(business, /<VerifiedSleepingDetails placeName=\{localizedPropertyName\} rooms=\{verifiedSleepingRooms\} \/>/);
});
