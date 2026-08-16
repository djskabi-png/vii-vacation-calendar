import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const bookingHub = readFileSync(new URL("../app/components/vacation-booking-hub.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("business phone stays private until the visitor asks to reveal it", () => {
  assert.match(business, /const \[phoneRevealed, setPhoneRevealed\] = useState\(false\)/);
  assert.match(business, />הצגת מספר<\/button>/);
  assert.match(business, /onClick=\{\(\) => setPhoneRevealed\(true\)\}/);
  assert.match(business, /<a className="property-phone-action property-phone-action--revealed" href=\{phoneHref\}/);
  assert.match(business, /<span dir="ltr">\{property\.contact\?\.phone\}<\/span>/);
});

test("date launcher uses one clear mobile hierarchy", () => {
  assert.match(bookingHub, /"תאריכים ואורחים"/);
  assert.match(bookingHub, /"בדיקת זמינות"/);
  assert.match(bookingHub, /\{hasDates \? <span className="vacation-booking-hub__launcher-action">שינוי<\/span> : null\}/);
  assert.doesNotMatch(bookingHub, />בחירה<\/span>/);
  assert.doesNotMatch(bookingHub, /vacation-booking-hub__launcher-action-short/);
  assert.doesNotMatch(bookingHub, />פירוט<\/span>/);
});

test("mobile amenities stay short until the visitor expands them", () => {
  assert.match(business, /<h2>מתקנים ושירותים<\/h2>/);
  assert.match(business, /mobileFeaturePreview\.map/);
  assert.match(business, /hidden=\{!mobileFeaturesOpen\}/);
  assert.match(business, /"הצגת כל המתקנים"/);
  assert.match(styles, /\.feature-section__mobile-groups\[hidden\] \{ display: none; \}/);
  assert.doesNotMatch(business, /<h2>מה מחכה לכם במקום<\/h2>/);
});

test("single-property room section no longer uses the redundant heading", () => {
  assert.doesNotMatch(business, /"המקום שמזמינים"/);
  assert.match(business, /property\.scenario === "single" \? "פרטי המקום"/);
});
