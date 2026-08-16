import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8");
const hub = readFileSync(new URL("../app/components/vacation-booking-hub.tsx", import.meta.url), "utf8");
const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");

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

test("a live whole-property quote is never mixed with editorial unit prices", () => {
  assert.match(hub, /legacyAvailabilitySourceFor\(property\.slug\)/);
  assert.match(hub, /availability!\.units!\.length === units\.length/);
  assert.match(hub, /\{hasUnitAvailability \? <div className="vacation-booking-dialog__units">/);
  assert.match(business, /property\.scenario === "single" && usesLiveLegacyAvailability/);
});
