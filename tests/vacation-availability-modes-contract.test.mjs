import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("Vacation place pages separate live, inquiry-only and temporary failure states", async () => {
  const page = await readFile(new URL("app/business/client-page.tsx", root), "utf8");
  const hub = await readFile(new URL("app/components/vacation-booking-hub.tsx", root), "utf8");
  assert.match(page, /vacationAvailabilityMode: "live" \| "demo" \| "inquiry"/);
  assert.match(page, /effectiveVacationAvailability = vacationAvailabilityMode !== "inquiry"/);
  assert.match(page, /property\.demoOperations\?\.fictional \? "demo" : "inquiry"/);
  assert.match(hub, /availabilityMode === "demo" \? "זמינות לדוגמה"/);
  assert.doesNotMatch(page, /Boolean\(property\.demoOperations\?\.fictional\) \? "live"/);
  assert.match(hub, /state === "inquiry-only"/);
  assert.match(hub, /state === "check-error"/);
  assert.match(hub, /state === "inquiry-only"[\s\S]*title: "התקשרו לבירור זמינות"/);
  assert.match(hub, /state === "inquiry-only"[\s\S]*buttonLabel="פנייה לבירור זמינות"/);
  assert.match(hub, /לא הצלחנו לבדוק כרגע/);
  assert.match(hub, /onRetryAvailability/);
  assert.match(hub, /initialTill=\{till\}/);
});

test("the legacy API returns an honest multi-unit recommendation and inventory status", async () => {
  const route = await readFile(new URL("app/api/legacy-availability/route.ts", root), "utf8");
  assert.match(route, /recommendVacationUnits\(unitQuotes, guests\)/);
  assert.match(route, /availability: recommendation \? "available" : "unavailable"/);
  assert.match(route, /availability: availableCount > 0 \? "available" as const : "unavailable" as const/);
  assert.doesNotMatch(route, /guests <= room\.maxGuests/);
  assert.doesNotMatch(route, /Math\.min\(\.\.\.availablePrices\)/);
});

test("unit cards keep only compact facts and place status and price above the action", async () => {
  const page = await readFile(new URL("app/business/client-page.tsx", root), "utf8");
  const statusPosition = page.indexOf("room-card__availability");
  const actionPosition = page.indexOf("room-card__actions", statusPosition);
  assert.ok(statusPosition > 0 && actionPosition > statusPosition);
  assert.match(page, /room-card__facts[\s\S]*פרטי היחידה/);
  assert.doesNotMatch(page, /כל פרטי היחידה \+/);
  assert.doesNotMatch(page, /room-card__features/);
  assert.doesNotMatch(page, /room-card__sleeping/);
});

test("the party recommendation is shown before the unit list", async () => {
  const hub = await readFile(new URL("app/components/vacation-booking-hub.tsx", root), "utf8");
  const recommendationPosition = hub.indexOf("vacation-booking-dialog__recommendation");
  const unitsPosition = hub.indexOf("vacation-booking-dialog__units", recommendationPosition);
  assert.ok(recommendationPosition > 0 && unitsPosition > recommendationPosition);
  assert.match(hub, /ההמלצה שלנו להרכב שלכם/);
  assert.match(hub, /recommendation\.unitCount === 1/);
  assert.match(hub, /recommendationNeedsEnquiry/);
});
