import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8");

test("a migrated vacation booking rechecks the live source before showing an online flow", () => {
  assert.match(client, /useLegacyAvailability\(vacationProperty/);
  assert.match(client, /legacyAvailabilitySourceFor\(vacationProperty\.slug\)/);
  assert.match(client, /liveAvailability\.quote\?\.availability === "available"/);
  assert.match(client, /liveSourceEnabled \? liveBookingReady/);
  assert.match(client, /בודקים זמינות ומחיר עדכניים/);
});

test("the booking total identifies the stay, nightly rate, guest party and taxes", () => {
  assert.match(client, /Total for the entire stay/);
  assert.match(client, /VAT and all mandatory taxes included/);
  assert.match(client, /pricing\.nightlyPrice.*labels\.night/);
  assert.match(client, /pricing\.wholeProperty/);
});
