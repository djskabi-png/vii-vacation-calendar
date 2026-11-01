import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const businessPage = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const bookingHub = readFileSync(new URL("../app/components/vacation-booking-hub.tsx", import.meta.url), "utf8");

test("Hebrew unit date labels attach the preposition to the unit name", () => {
  for (const source of [businessPage, bookingHub]) {
    assert.match(source, /language === "he" \? `\$\{prefix\}\$\{unitName\}` : `\$\{prefix\} \$\{unitName\}`/);
  }
});

test("unit date actions use the locale-aware label formatter", () => {
  assert.match(businessPage, /unitActionLabel\(unitCopy\.dates,/);
  assert.match(bookingHub, /unitActionLabel\(unitCopy\.checkDates,/);
  assert.doesNotMatch(bookingHub, /\{unitCopy\.checkDates\} \{translate\(room\.name\)\}/);
});
