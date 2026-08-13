import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");

test("booking summary groups the selection and actions without touching controls", () => {
  assert.match(business, /className="booking-card__selection"/);
  assert.match(business, /className="booking-card__actions"/);
  assert.match(styles, /\.booking-card__selection \{ display: grid; gap: 9px; \}/);
  assert.match(styles, /\.booking-card__actions \{ display: grid; gap: 10px; \}/);
  assert.match(styles, /\.booking-card__actions \.button \{ min-height: 50px; margin: 0; \}/);
});

test("booking summary is contained and comfortably padded on mobile", () => {
  assert.match(styles, /\.property-layout > \.booking-card,\.event-place-layout > \.booking-card \{ width: min\(100%, 520px\); margin-inline: auto; \}/);
  assert.match(styles, /@media \(max-width: 560px\) \{[\s\S]*?\.booking-card \{ padding: 22px 20px; border-radius: 22px; \}/);
});

test("mobile privacy choices stay compact and do not cover the first result", () => {
  assert.match(styles, /\.cookie-card \{ inset-inline: 12px; bottom: max\(12px,env\(safe-area-inset-bottom\)\); grid-template-columns: 1fr; gap: 10px; padding: 14px; border-radius: 20px; \}/);
  assert.match(styles, /\.cookie-actions \{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; \}/);
});
