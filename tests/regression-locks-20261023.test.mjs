import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { bookingReturnHref } from "../app/lib/booking-return-href.ts";
import { publicFeatureLabels } from "../app/lib/public-feature-policy.ts";
import { discoveryBreadcrumbsForLocation } from "../app/lib/place-breadcrumb-locations.ts";

test("booking return destinations follow the source world instead of forcing every place through /business", () => {
  assert.equal(bookingReturnHref({ world: "activities", placeId: "hamat-gader" }), "/discover/place/hamat-gader");
  assert.equal(bookingReturnHref({ world: "spa", placeId: "spa-12" }), "/discover/place/spa-12");
  assert.equal(bookingReturnHref({ world: "hourly", placeId: "hourly-7" }), "/discover/place/hourly-7");
  assert.equal(bookingReturnHref({ world: "providers", placeId: "maor-natan" }), "/discover/place/maor-natan");
  assert.equal(bookingReturnHref({ world: "events", placeId: "event-9" }), "/events/place/event-9");
  assert.equal(bookingReturnHref({ world: "vacation", placeId: "vacation-116", from: "2026-10-24", till: "2026-10-25", guests: "2" }), "/business?id=vacation-116&from=2026-10-24&till=2026-10-25&guests=2");
});

test("form consent and marketing opt-in labels can never become public features", () => {
  assert.deepEqual(publicFeatureLabels([
    "מעיינות חמים",
    "אני מסכים/ה לקבל דיוור מחמת גדר",
    "אישור לקבלת פרסום",
    "Marketing consent",
    "בריכות",
  ]), ["מעיינות חמים", "בריכות"]);
});

test("contradictory supplier capacity claims cannot override the authoritative catalog capacity", () => {
  assert.deepEqual(publicFeatureLabels([
    "8 חדרי שינה",
    "מתאים לאירוח סולידי עד 25 אורחים",
    "ג'קוזי ספא ענק",
  ], { maxGuests: 20 }), ["8 חדרי שינה", "ג'קוזי ספא ענק"]);
  assert.deepEqual(publicFeatureLabels(["מתאים עד 20 אורחים"], { maxGuests: 20 }), ["מתאים עד 20 אורחים"]);
});

test("activity and trail breadcrumbs preserve verified area then locality", () => {
  assert.deepEqual(discoveryBreadcrumbsForLocation("activities", "כנרת והעמקים", "חמת גדר"), [
    { name: "אטרקציות בכנרת והעמקים", path: "/attractions?location=%D7%9B%D7%A0%D7%A8%D7%AA%20%D7%95%D7%94%D7%A2%D7%9E%D7%A7%D7%99%D7%9D" },
    { name: "אטרקציות בחמת גדר", path: "/attractions?location=%D7%97%D7%9E%D7%AA%20%D7%92%D7%93%D7%A8" },
  ]);
  assert.equal(discoveryBreadcrumbsForLocation("trails", "צפון", "אצבע הגליל").length, 2);
});

test("supplier detail cannot erase a catalog WhatsApp number with undefined", async () => {
  const source = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
  assert.match(source, /\.\.\.\(supplierDetail\.whatsapp \? \{ whatsapp: supplierDetail\.whatsapp \} : \{\}\)/);
  assert.doesNotMatch(source, /contact:\s*\{\s*\.\.\.base\.contact,\s*whatsapp:\s*supplierDetail\.whatsapp\s*\}/);
});

test("detail maps remain passive when a stored snapshot is missing", async () => {
  const source = await readFile(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8");
  assert.match(source, /const placeFallback = snapshotUnavailable;/);
  assert.doesNotMatch(source, /else if \(single\) setEnabled\(true\)/);
  assert.match(source, /!enabled && <button className="button map-load-button"/);
});

test("non-stay booking copy is world-aware and does not call every booking a stay", async () => {
  const booking = await readFile(new URL("../app/booking/client-page.tsx", import.meta.url), "utf8");
  const schedule = await readFile(new URL("../app/components/booking-schedule-picker.tsx", import.meta.url), "utf8");
  assert.match(booking, /details: "פרטי הפעילות"/);
  assert.match(booking, /details: "פרטי האירוע"/);
  assert.match(booking, /details: "פרטי השירות"/);
  assert.match(schedule, /בחרו מועד \$\{appointmentLabel\}/);
  assert.match(schedule, /שעה מועדפת, לא חובה/);
});

test("visible and structured breadcrumbs share the expanded activity and trail hierarchy", async () => {
  const server = await readFile(new URL("../app/discover/place/[id]/page.tsx", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/discover/place/client-page.tsx", import.meta.url), "utf8");
  const trail = await readFile(new URL("../app/trails/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(server, /discoveryBreadcrumbsForLocation\("activities", item\.area, item\.location\)/);
  assert.match(client, /discoveryBreadcrumbsForLocation\("activities", item\.area, item\.location\)/);
  assert.match(trail, /breadcrumbSchema\(trailBreadcrumbs\)/);
  assert.match(trail, /<BreadcrumbTrail items=\{trailBreadcrumbs\.map/);
});
