import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");

test("mobile WhatsApp booking action keeps a reachable safe-area footer", () => {
  assert.match(business, /buttonClassName="button primary wide booking-whatsapp"/);
  assert.match(styles, /\.property-layout \{ padding-bottom: max\(56px, calc\(32px \+ env\(safe-area-inset-bottom\)\)\); \}/);
  assert.match(styles, /\.booking-card--request \{ overflow: visible;[^}]*padding-bottom: max\(32px, calc\(24px \+ env\(safe-area-inset-bottom\)\)\)/);
  assert.match(styles, /\.booking-card--request \.booking-whatsapp \{ min-height: 54px; margin-bottom: 8px; scroll-margin-bottom:/);
});
