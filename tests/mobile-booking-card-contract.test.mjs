import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const vacationHub = readFileSync(new URL("../app/components/vacation-booking-hub.tsx", import.meta.url), "utf8");

test("mobile booking actions keep a reachable safe-area dialog footer", () => {
  assert.match(business, /<VacationBookingHub/);
  assert.match(vacationHub, /buttonClassName="button primary vacation-booking-dialog__whatsapp"/);
  assert.match(styles, /\.property-layout \{ padding-bottom: max\(56px, calc\(32px \+ env\(safe-area-inset-bottom\)\)\); \}/);
  assert.match(styles, /\.vacation-booking-dialog__footer \{[\s\S]*env\(safe-area-inset-bottom\)/);
  assert.match(styles, /\.vacation-booking-dialog__footer-actions \.button \{ width: 100%; min-width: 0; min-height: 48px; \}/);
  assert.match(styles, /\.vacation-booking-hub \{ width: calc\(100% - 24px\)/);
});
